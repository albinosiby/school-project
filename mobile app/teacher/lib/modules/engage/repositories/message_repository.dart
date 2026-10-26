import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/data_store.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';

class LocalMessageRepository implements IMessageRepository {
  LocalMessageRepository(this._db);
  final DataStore _db;
  static const _threads = 'ms_messages', _contacts = 'ms_contacts', _drafts = 'ms_drafts';

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
    final t = await getThread(threadId);
    if (t == null) return;
    _db.update(_threads, threadId, {'msgs': [...t.msgs.map((m) => m.toJson()), message.toJson()]});
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
      if (r == null) continue;
      final existing = _db.list(_threads).where((t) => t['key'] == id).firstOrNull;
      if (existing != null) {
        final t = MessageThread.fromJson(existing);
        _db.update(_threads, t.id, {'msgs': [...t.msgs.map((m) => m.toJson()), ...msgs], 'subject': subject.isEmpty ? t.subject : subject, 'unread': 0});
      } else {
        final t = MessageThread(
          key: id, name: r.name, role: r.broadcast ? r.extra.split(' • ').first : r.role, kind: r.kind, online: r.online, subject: subject, members: r.broadcast ? 42 : 0,
        ).toJson()
          ..remove('id')
          ..['msgs'] = msgs;
        _db.add(_threads, t);
      }
    }
  }

  String _clsLabel(String classId) {
    final c = _db.byId('classes', classId);
    return c == null ? '' : '${c['grade']}-${c['section']}';
  }

  Recipient _student(Rec st) {
    final cl = _clsLabel('${st['classId']}');
    return Recipient(id: '${st['id']}', name: '${st['name']}', role: 'Student ($cl)', kind: 'student', sub: 'Class $cl • Roll ${st['roll']}');
  }

  Recipient _guardian(Rec st) {
    final cl = _clsLabel('${st['classId']}');
    return Recipient(
      id: 'g_${st['id']}', name: '${st['guardian']} ${'${st['name']}'.split(' ').last}', role: 'Parent ($cl)', kind: 'parent', sub: 'Parent of ${st['name']} (Roll #${st['roll']})',
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
  Stream<void> watch() => _db.watch({_threads, _contacts, _drafts, 'students'});
}
