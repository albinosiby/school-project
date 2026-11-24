import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/data_store.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';

class LocalMessageRepository implements IMessageRepository {
  LocalMessageRepository(this._db);
  final DataStore _db;
  static const _threads = 'ms_messages', _contacts = 'ms_contacts', _drafts = 'ms_drafts', _meetings = 'ms_meetings';

  @override
  Future<List<MessageThread>> getThreads() async => [for (final r in _db.list(_threads)) MessageThread.fromJson(r)];

  @override
  Future<MessageThread?> getThread(String id) async {
    final r = _db.byId(_threads, id);
    return r == null ? null : MessageThread.fromJson(r);
  }

  @override
  Future<void> markRead(String id) async {
    final t = await getThread(id);
    if (t == null || t.unread == 0) return;
    _db.update(_threads, id, {'unread': 0, 'msgs': [for (final m in t.msgs) m.copyWith(read: true).toJson()]});
  }

  @override
  Future<void> markUnread(String id) async => _db.update(_threads, id, {'unread': 1});

  @override
  Future<void> setPinned(String id, bool pinned) async => _db.update(_threads, id, {'pinned': pinned});

  @override
  Future<void> deleteThread(String id) async => _db.remove(_threads, id);

  @override
  Future<void> reply(String threadId, ThreadMessage message) async {
    final t = await getThread(threadId) ?? _byKey(threadId);
    if (t != null) {
      _db.update(_threads, t.id, {'msgs': [...t.msgs.map((m) => m.toJson()), message.toJson()]});
      return;
    }
    // no conversation yet: [threadId] is a recipient id and this message starts it
    final r = await resolveRecipient(threadId);
    if (r == null || !r.available) return;
    _db.add(_threads, _newThread(r, msgs: [message.toJson()]));
  }

  MessageThread? _byKey(String key) {
    final r = _db.list(_threads).where((t) => t['key'] == key).firstOrNull;
    return r == null ? null : MessageThread.fromJson(r);
  }

  Rec _newThread(Recipient r, {required List<Rec> msgs, String subject = ''}) => MessageThread(
        key: r.id, name: r.name, role: r.broadcast ? r.extra.split(' • ').first : r.role, kind: r.kind, online: r.online, subject: subject, members: r.broadcast ? 42 : 0,
        phone: r.phone, studentId: r.id.startsWith('g_') ? r.id.substring(2) : '', studentName: r.studentName, photo: r.photo,
      ).toJson()
        ..remove('id')
        ..['msgs'] = msgs;

  @override
  Future<List<ChatMeeting>> getMeetings({String? threadId}) async {
    final rows = [for (final r in _db.list(_meetings)) ChatMeeting.fromJson(r)];
    rows.sort((a, b) => '${b.date}T${b.time}'.compareTo('${a.date}T${a.time}'));
    return threadId == null ? rows : rows.where((m) => m.threadId == threadId).toList();
  }

  @override
  Future<ChatMeeting> scheduleMeeting(String threadId, ChatMeeting meeting) async {
    final now = nowIso();
    final json = meeting.toJson()
      ..remove('id')
      ..['threadId'] = threadId
      ..['status'] = 'scheduled'
      ..['createdAt'] = now
      ..['updatedAt'] = now;
    final saved = ChatMeeting.fromJson(_db.add(_meetings, json));
    await reply(threadId, ThreadMessage(text: '📅 Meeting scheduled', ts: now, meeting: saved));
    return saved;
  }

  @override
  Future<void> rescheduleMeeting(String id, ChatMeeting next) async {
    final r = _db.byId(_meetings, id);
    if (r == null) return;
    final now = nowIso();
    final updated = ChatMeeting.fromJson(_db.update(_meetings, id, {'date': next.date, 'time': next.time, 'link': next.link, 'note': next.note, 'status': 'scheduled', 'updatedAt': now})!);
    await reply(updated.threadId, ThreadMessage(text: '📅 Meeting rescheduled', ts: now, meeting: updated));
  }

  @override
  Future<void> cancelMeeting(String id) async {
    final r = _db.byId(_meetings, id);
    if (r == null) return;
    final now = nowIso();
    final updated = ChatMeeting.fromJson(_db.update(_meetings, id, {'status': 'cancelled', 'updatedAt': now})!);
    await reply(updated.threadId, ThreadMessage(text: '📅 Meeting cancelled', ts: now, meeting: updated));
  }

  @override
  Future<void> send({required List<String> to, required String text, String subject = '', List<FileRef> attach = const []}) async {
    final now = nowIso();
    final msgs = [
      ThreadMessage(text: text, ts: now, attach: attach.isEmpty ? null : attach.first).toJson(),
      for (final f in attach.skip(1)) ThreadMessage(ts: now, attach: f).toJson(),
    ];
    for (final id in to) {
      final r = await resolveRecipient(id);
      if (r == null || !r.available) continue;
      final t = _byKey(id);
      if (t != null) {
        _db.update(_threads, t.id, {'msgs': [...t.msgs.map((m) => m.toJson()), ...msgs], 'subject': subject.isEmpty ? t.subject : subject, 'unread': 0});
      } else {
        _db.add(_threads, _newThread(r, msgs: msgs, subject: subject));
      }
    }
  }

  String _clsLabel(String classId) {
    final c = _db.byId('classes', classId);
    return c == null ? '' : '${c['grade']}-${c['section']}';
  }

  /// The roll number, or 0 when none has been allotted yet (`''`, `0` or missing).
  static int _roll(Rec st) => (st['roll'] as num?)?.toInt() ?? int.tryParse('${st['roll'] ?? ''}') ?? 0;

  Recipient _student(Rec st) {
    final cl = _clsLabel('${st['classId']}');
    return Recipient(id: '${st['id']}', name: '${st['name']}', role: 'Student ($cl)', kind: 'student', sub: _roll(st) == 0 ? 'Class $cl' : 'Class $cl • Roll ${_roll(st)}', photo: '${st['photo'] ?? ''}');
  }

  /// Students synced from the school (Firebase mode) carry `guardianUids`; an empty list means no parent app login,
  /// so the guardian is listed but cannot be messaged. Local seed students have no such field and stay messageable.
  static const noParentLogin = 'No parent app login';

  Recipient _guardian(Rec st) {
    final cl = _clsLabel('${st['classId']}');
    final uids = st['guardianUids'];
    return Recipient(
      id: 'g_${st['id']}', name: '${st['guardian']} ${'${st['name']}'.split(' ').last}', role: 'Parent ($cl)', kind: 'parent', sub: _roll(st) == 0 ? 'Parent of ${st['name']}' : 'Parent of ${st['name']} (Roll #${_roll(st)})',
      blocked: uids is List && uids.isEmpty ? noParentLogin : '', phone: '${st['phone'] ?? ''}', studentName: '${st['name'] ?? ''}', photo: '${st['photo'] ?? ''}',
    );
  }

  @override
  Future<List<Recipient>> getRecipients() async => [
        for (final c in _db.list(_contacts)) Recipient.fromJson(c),
        for (final st in _db.list('students')) ...[_guardian(st), _student(st)],
      ];

  @override
  Future<Recipient?> resolveRecipient(String id) async {
    final c = _db.byId(_contacts, id);
    if (c != null) return Recipient.fromJson(c);
    final isG = id.startsWith('g_');
    final st = _db.byId('students', isG ? id.substring(2) : id);
    if (st == null) return null;
    return isG ? _guardian(st) : _student(st);
  }

  @override
  Future<List<MessageDraft>> getDrafts() async => [for (final r in _db.list(_drafts)) MessageDraft.fromJson(r)];

  @override
  Future<MessageDraft?> getDraft(String id) async {
    final r = _db.byId(_drafts, id);
    return r == null ? null : MessageDraft.fromJson(r);
  }

  @override
  Future<MessageDraft> saveDraft(MessageDraft draft) async {
    final json = draft.toJson();
    if (draft.id.isNotEmpty && _db.byId(_drafts, draft.id) != null) return MessageDraft.fromJson(_db.update(_drafts, draft.id, json)!);
    json.remove('id');
    return MessageDraft.fromJson(_db.add(_drafts, json));
  }

  @override
  Future<void> deleteDraft(String id) async => _db.remove(_drafts, id);

  @override
  Future<void> deleteAllDrafts() async {
    for (final d in _db.list(_drafts).toList()) {
      _db.remove(_drafts, '${d['id']}');
    }
  }

  @override
  Stream<void> watch() => _db.watch({_threads, _contacts, _drafts, _meetings, 'students'});
}
