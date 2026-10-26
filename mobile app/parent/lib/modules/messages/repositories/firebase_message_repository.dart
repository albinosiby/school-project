import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/local_storage_service.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';

/// Parent ↔ teacher messages (data contract §13.3): `msg_threads/thr_{studentId}_{staffId}` and `msg_messages`.
/// Every query carries `parentUids array-contains uid`, which is what the rules check. A Cloud Function updates the
/// thread's last message and unread counters; the app only resets its own `unreadParent`.
/// Contacts are the child's class teacher and subject teachers (from the class timetable). Pins and drafts are
/// this device's preferences (local storage). Attachments are listed by name until file uploads exist.
class FirebaseMessageRepository implements IMessageRepository {
  FirebaseMessageRepository(this._session, this._storage);
  final ParentSession _session;
  final LocalStorageService _storage;
  final _local = StreamController<void>.broadcast();

  String get _pinKey => 'msg_pins:${_session.uid}';
  String get _draftKey => 'msg_drafts:${_session.uid}';

  // ---------------------------------------------------------------- reads

  @override
  Stream<MessagesOverview> watchOverview(String childId) => _withLocal(_threads(childId)).map((threads) {
        final pins = _pins();
        final list = [for (final t in threads) _withPin(t, pins)]
          ..sort((a, b) => a.pinned != b.pinned ? (a.pinned ? -1 : 1) : b.lastAt.compareTo(a.lastAt));
        return MessagesOverview(threads: list, drafts: _drafts().where((d) => d.childId == childId).toList());
      });

  @override
  Stream<int> watchUnreadCount(String childId) => _threads(childId).map((t) => t.where((x) => x.unread > 0).length);

  @override
  Stream<Conversation> watchConversation(String threadId) {
    markRead(threadId);
    final thread = _session.col('msg_threads').doc(threadId).snapshots();
    final messages = _session
        .col('msg_messages')
        .where('parentUids', arrayContains: _session.uid)
        .where('threadId', isEqualTo: threadId)
        .snapshots();
    return combineLatest<Object>([thread, messages]).map((both) {
      final t = both[0] as DocumentSnapshot<Json>;
      final q = both[1] as QuerySnapshot<Json>;
      final msgs = [
        for (final doc in q.docs)
          ChatMessage(
            id: doc.id,
            threadId: threadId,
            fromParent: doc.data()['from'] == 'parent',
            text: '${doc.data()['text'] ?? ''}',
            at: parseTime(doc.data()['at']) ?? DateTime.now(),
          ),
      ]..sort((a, b) => a.at.compareTo(b.at));
      if (msgs.isNotEmpty && !msgs.last.fromParent && ((t.data()?['unreadParent'] as num?) ?? 0) > 0) markRead(threadId);
      return Conversation(thread: _withPin(threadOf(t.id, t.data() ?? const {}), _pins()), messages: msgs);
    });
  }

  @override
  Stream<List<MessageContact>> watchContacts(String childId) async* {
    final child = await _session.student(childId);
    final classId = '${child['classId'] ?? ''}';
    if (classId.isEmpty) {
      yield const [];
      return;
    }
    final cls = (await _session.col('classes').doc(classId).get()).data() ?? const {};
    yield* _session.col('ops_periods').where('classId', isEqualTo: classId).snapshots().map((q) {
      final byTeacher = <String, ({String name, Set<String> subjects})>{};
      for (final doc in q.docs) {
        final id = '${doc.data()['teacherId'] ?? ''}';
        if (id.isEmpty) continue;
        final e = byTeacher[id] ??= (name: '${doc.data()['teacher'] ?? ''}', subjects: <String>{});
        e.subjects.add('${doc.data()['subject'] ?? ''}');
      }
      final ctId = '${cls['classTeacherId'] ?? ''}';
      if (ctId.isNotEmpty) byTeacher.putIfAbsent(ctId, () => (name: '${cls['classTeacher'] ?? ''}', subjects: <String>{}));
      final contacts = [
        for (final e in byTeacher.entries)
          MessageContact(
            id: e.key,
            name: e.value.name,
            shortName: shortName(e.value.name),
            role: e.key == ctId ? 'Class Teacher' : (e.value.subjects.where((s) => s.isNotEmpty).join(', ')),
            badge: e.key == ctId ? 'Class Teacher' : (e.value.subjects.firstOrNull ?? 'Teacher'),
            kind: e.key == ctId ? ContactKind.classTeacher : ContactKind.subjectTeacher,
          ),
      ]..sort((a, b) => a.kind == b.kind ? a.name.compareTo(b.name) : (a.kind == ContactKind.classTeacher ? -1 : 1));
      return contacts;
    });
  }

  // ---------------------------------------------------------------- writes

  @override
  Future<void> send(String threadId, String text, {List<MessageAttachment> attachments = const []}) async {
    final body = _withAttachments(text.trim(), attachments);
    if (body.isEmpty) return;
    final thread = (await _session.col('msg_threads').doc(threadId).get()).data();
    if (thread == null) throw StateError('Conversation not found');
    await _session.col('msg_messages').add({
      'threadId': threadId,
      'studentId': thread['studentId'],
      'teacherId': thread['teacherId'],
      'parentUids': thread['parentUids'],
      'from': 'parent',
      'uid': _session.uid,
      'name': '${_session.user['name'] ?? 'Parent'}',
      'text': body,
      'at': nowUtc(),
    });
  }

  @override
  Future<void> markRead(String threadId) => _session.col('msg_threads').doc(threadId).update({'unreadParent': 0}).catchError((_) {});

  @override
  Future<void> markAllRead(String childId) async {
    for (final t in await _threads(childId).first) {
      if (t.unread > 0) await markRead(t.id);
    }
  }

  @override
  Future<void> setPinned(String threadId, bool pinned) async {
    final pins = _pins();
    pinned ? pins.add(threadId) : pins.remove(threadId);
    await _storage.setString(_pinKey, jsonEncode(pins.toList()));
    _local.add(null);
  }

  /// Opens (or reuses) the conversation with the chosen teacher and sends the first message.
  @override
  Future<MessageThread> startThread(NewMessageRequest request) async {
    final contacts = await watchContacts(request.childId).first;
    final contact = contacts.where((c) => c.id == request.contactId).firstOrNull;
    final id = 'thr_${request.childId}_${request.contactId}';
    final ref = _session.col('msg_threads').doc(id);
    if (!(await ref.get().then((s) => s.exists).catchError((_) => false))) {
      final child = await _session.student(request.childId);
      await ref.set({
        'studentId': request.childId,
        'classId': '${child['classId'] ?? ''}',
        'studentName': '${child['name'] ?? ''}',
        // every linked guardian of the child sees the conversation
        'parentUids': {_session.uid, ...[for (final u in (child['guardianUids'] as List?) ?? const []) '$u']}.toList(),
        'guardian': '${_session.user['name'] ?? child['guardian'] ?? ''}',
        'teacherId': request.contactId,
        'teacher': contact?.name ?? '',
        'role': contact?.role ?? '',
        'lastMessage': '',
        'lastAt': nowUtc(),
        'lastFrom': 'parent',
        'unreadParent': 0,
        'unreadTeacher': 0,
        'createdAt': nowUtc(),
      });
    }
    final subject = request.subject.trim();
    await send(id, [if (subject.isNotEmpty) '[${request.category.label}] $subject', request.body.trim()].join('\n'),
        attachments: request.attachments);
    if (request.draftId != null) await deleteDraft(request.draftId!);
    return threadOf(id, (await ref.get()).data() ?? const {});
  }

  @override
  Future<MessageDraft?> draft(String draftId) async => _drafts().where((d) => d.id == draftId).firstOrNull;

  @override
  Future<MessageDraft> saveDraft(MessageDraft draft) async {
    final saved = draft.id.isEmpty
        ? MessageDraft(
            id: 'dr_${DateTime.now().microsecondsSinceEpoch}',
            childId: draft.childId,
            updatedAt: DateTime.now(),
            contactId: draft.contactId,
            category: draft.category,
            subject: draft.subject,
            body: draft.body,
            attachments: draft.attachments,
          )
        : draft;
    await _saveDrafts([..._drafts().where((d) => d.id != saved.id), saved]);
    return saved;
  }

  @override
  Future<void> deleteDraft(String draftId) => _saveDrafts(_drafts().where((d) => d.id != draftId).toList());

  // ---------------------------------------------------------------- helpers

  Stream<List<MessageThread>> _threads(String childId) => _session
      .col('msg_threads')
      .where('parentUids', arrayContains: _session.uid)
      .where('studentId', isEqualTo: childId)
      .snapshots()
      .map((q) => [for (final doc in q.docs) threadOf(doc.id, doc.data())]);

  /// Re-emits the last value whenever a local preference (pin, draft) changes.
  Stream<T> _withLocal<T>(Stream<T> source) {
    late final StreamController<T> out;
    final subs = <StreamSubscription<Object?>>[];
    T? last;
    var has = false;
    out = StreamController<T>(
      onListen: () => subs
        ..add(source.listen((v) {
          last = v;
          has = true;
          out.add(v);
        }, onError: out.addError))
        ..add(_local.stream.listen((_) {
          if (has) out.add(last as T);
        })),
      onCancel: () async {
        for (final s in subs) {
          await s.cancel();
        }
      },
    );
    return out.stream;
  }

  static MessageThread threadOf(String id, Json d) {
    final role = '${d['role'] ?? ''}';
    return MessageThread(
      id: id,
      childId: '${d['studentId'] ?? ''}',
      contactId: '${d['teacherId'] ?? ''}',
      teacher: '${d['teacher'] ?? ''}',
      role: role,
      subtitle: '${d['studentName'] ?? ''}',
      lastMessage: '${d['lastMessage'] ?? ''}',
      lastAt: parseTime(d['lastAt']) ?? DateTime.fromMillisecondsSinceEpoch(0),
      unread: (d['unreadParent'] as num?)?.toInt() ?? 0,
      kind: role == 'Class Teacher' ? ContactKind.classTeacher : ContactKind.subjectTeacher,
      verified: true,
    );
  }

  MessageThread _withPin(MessageThread t, Set<String> pins) => pins.contains(t.id)
      ? MessageThread(
          id: t.id,
          childId: t.childId,
          contactId: t.contactId,
          teacher: t.teacher,
          role: t.role,
          subtitle: t.subtitle,
          lastMessage: t.lastMessage,
          lastAt: t.lastAt,
          unread: t.unread,
          kind: t.kind,
          subject: t.subject,
          verified: t.verified,
          pinned: true,
        )
      : t;

  Set<String> _pins() {
    try {
      return {for (final e in jsonDecode(_storage.getString(_pinKey) ?? '[]') as List) '$e'};
    } catch (_) {
      return {};
    }
  }

  List<MessageDraft> _drafts() {
    try {
      return [
        for (final e in jsonDecode(_storage.getString(_draftKey) ?? '[]') as List)
          if (e is Map)
            MessageDraft(
              id: '${e['id']}',
              childId: '${e['childId']}',
              updatedAt: DateTime.tryParse('${e['updatedAt']}') ?? DateTime.now(),
              contactId: e['contactId'] as String?,
              category: MessageCategory.values.asNameMap()['${e['category']}'] ?? MessageCategory.academic,
              subject: '${e['subject'] ?? ''}',
              body: '${e['body'] ?? ''}',
              attachments: [
                for (final a in (e['attachments'] as List?) ?? const [])
                  if (a is Map) MessageAttachment(name: '${a['name']}', sizeKb: (a['sizeKb'] as num?)?.toInt() ?? 0),
              ],
            ),
      ];
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveDrafts(List<MessageDraft> drafts) async {
    await _storage.setString(
      _draftKey,
      jsonEncode([
        for (final d in drafts)
          {
            'id': d.id,
            'childId': d.childId,
            'updatedAt': d.updatedAt.toIso8601String(),
            'contactId': d.contactId,
            'category': d.category.name,
            'subject': d.subject,
            'body': d.body,
            'attachments': [for (final a in d.attachments) {'name': a.name, 'sizeKb': a.sizeKb}],
          },
      ]),
    );
    _local.add(null);
  }

  static String _withAttachments(String text, List<MessageAttachment> files) =>
      [if (text.isNotEmpty) text, for (final f in files) 'Attachment: ${f.name}'].join('\n');

  /// "Mrs. Anita Sharma" -> "Mrs. Sharma".
  static String shortName(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length <= 2) return name;
    return '${parts.first} ${parts.last}';
  }
}
