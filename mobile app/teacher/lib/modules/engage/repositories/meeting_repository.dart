import '../../../utils/services/data_store.dart';
import '../models/meeting_models.dart';
import 'engage_seed.dart';
import 'meeting_repository_interface.dart';

class LocalMeetingRepository implements IMeetingRepository {
  LocalMeetingRepository(this._db);
  final DataStore _db;
  static const _c = 'pm_meetings', _people = 'pm_participants', _waiting = 'pm_waiting', _chat = 'pm_chat';

  @override
  Future<List<Meeting>> getAll() async => [for (final r in _db.list(_c)) Meeting.fromJson(r)];

  @override
  Future<Meeting?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : Meeting.fromJson(r);
  }

  @override
  Future<Meeting> save(Meeting meeting) async {
    final json = meeting.toJson();
    final existing = meeting.id.isEmpty ? null : _db.byId(_c, meeting.id);
    if (existing != null) {
      for (final k in const ['rsvp', 'target', 'file', 'summary', 'startedAt']) {
        json[k] = existing[k];
      }
      return Meeting.fromJson(_db.update(_c, meeting.id, json)!);
    }
    json.remove('id');
    return Meeting.fromJson(_db.add(_c, {...json, 'rsvp': 0, 'target': 90, 'file': null, 'summary': ''}));
  }

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<void> addTopic(String id, AgendaTopic topic) async {
    final m = await get(id);
    if (m == null) return;
    _db.update(_c, id, {'agenda': [...m.agenda.map((a) => a.toJson()), topic.toJson()]});
  }

  @override
  Future<void> markStarted(String id) async => _db.update(_c, id, {'startedAt': DateTime.now().millisecondsSinceEpoch});

  @override
  Future<void> complete(String id, {required String summary}) async => _db.update(_c, id, {'status': MeetingStatus.completed.name, 'summary': summary});

  bool _of(Rec r, String mid) => r['meetingId'] == mid;

  @override
  Future<void> ensureRoom(String meetingId) async {
    if (_db.byId(_c, meetingId) == null) return;
    final has = [_people, _waiting, _chat].any((c) => _db.list(c).any((r) => _of(r, meetingId)));
    if (has) return;
    meetingRoomRows(meetingId).forEach((c, rows) {
      for (final r in rows) {
        _db.add(c, r, prepend: false);
      }
    });
  }

  @override
  Future<List<Participant>> getParticipants(String meetingId) async => [for (final r in _db.list(_people)) if (_of(r, meetingId)) Participant.fromJson(r)];

  @override
  Future<List<WaitingGuest>> getWaiting(String meetingId) async => [for (final r in _db.list(_waiting)) if (_of(r, meetingId)) WaitingGuest.fromJson(r)];

  @override
  Future<List<ChatMessage>> getChat(String meetingId) async =>
      [for (final r in _db.list(_chat)) if (_of(r, meetingId)) ChatMessage.fromJson(r)]..sort((a, b) => a.ts.compareTo(b.ts));

  @override
  Future<void> admit(String guestId) async {
    final w = _db.byId(_waiting, guestId);
    if (w == null) return;
    _db.remove(_waiting, guestId);
    final p = Participant(meetingId: '${w['meetingId']}', name: '${w['name']}', sub: '${w['sub'] ?? ''}').toJson()..remove('id');
    _db.add(_people, p, prepend: false);
  }

  @override
  Future<void> admitAll(String meetingId) async {
    for (final w in await getWaiting(meetingId)) {
      await admit(w.id);
    }
  }

  @override
  Future<void> deny(String guestId) async => _db.remove(_waiting, guestId);

  @override
  Future<void> setMuted(String participantId, bool muted) async => _db.update(_people, participantId, {'muted': muted});

  @override
  Future<void> muteAll(String meetingId) async {
    for (final p in await getParticipants(meetingId)) {
      _db.update(_people, p.id, {'muted': true, 'speaking': false});
    }
  }

  @override
  Future<void> sendChat(ChatMessage message) async {
    final json = message.toJson();
    if (message.id.isEmpty) json.remove('id');
    _db.add(_chat, json, prepend: false);
  }

  @override
  Future<void> togglePin(String chatId) async {
    final r = _db.byId(_chat, chatId);
    if (r != null) _db.update(_chat, chatId, {'pinned': r['pinned'] != true});
  }

  @override
  Stream<void> watch() => _db.watch({_c, _people, _waiting, _chat});
}
