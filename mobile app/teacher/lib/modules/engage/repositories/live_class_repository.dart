import '../../../utils/services/data_store.dart';
import '../models/live_class_models.dart';
import 'live_class_repository_interface.dart';

class LocalLiveClassRepository implements ILiveClassRepository {
  LocalLiveClassRepository(this._db);
  final DataStore _db;
  static const _c = 'lv_sessions';

  @override
  Future<List<LiveSession>> getAll() async => [for (final r in _db.list(_c)) LiveSession.fromJson(r)];

  @override
  Future<LiveSession?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : LiveSession.fromJson(r);
  }

  @override
  Future<LiveSession> save(LiveSession session) async {
    final json = session.toJson();
    final existing = session.id.isEmpty ? null : _db.byId(_c, session.id);
    if (existing != null) {
      for (final k in const ['room', 'joined', 'tag', 'cohost']) {
        json[k] = existing[k];
      }
      return LiveSession.fromJson(_db.update(_c, session.id, json)!);
    }
    json.remove('id');
    json['room'] = 'Room #0${_db.list(_c).length % 9 + 1}';
    json['joined'] = 0;
    return LiveSession.fromJson(_db.add(_c, json));
  }

  @override
  Future<void> setStatus(String id, LiveStatus status, {int? joined}) async => _db.update(_c, id, {'status': status.name, 'joined': ?joined});

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<void> recordJoin(String id) => _db.recordJoin(id);

  @override
  Stream<void> watch() => _db.watch({_c});
}
