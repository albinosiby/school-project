import '../../../utils/services/data_store.dart';
import '../models/classes_models.dart';
import 'behaviour_repository_interface.dart';

class LocalBehaviourRepository implements IBehaviourRepository {
  LocalBehaviourRepository(this._db);
  final DataStore _db;
  static const _logs = 'cl_behaviour', _badges = 'cl_badges';

  @override
  Future<List<BehaviourLog>> getLogs({String? classId, String? studentId}) async => [
        for (final r in _db.list(_logs))
          if ((classId == null || r['classId'] == classId) && (studentId == null || r['studentId'] == studentId)) BehaviourLog.fromJson(r)
      ];

  @override
  Future<BehaviourLog> addLog(BehaviourLog log) async => BehaviourLog.fromJson(_db.add(_logs, log.toJson()));

  @override
  Future<void> updateLog(BehaviourLog log) async => _db.update(_logs, log.id, log.toJson());

  @override
  Future<void> deleteLog(String id) async => _db.remove(_logs, id);

  @override
  Future<List<BehaviourBadge>> getBadges() async => [for (final r in _db.list(_badges)) BehaviourBadge.fromJson(r)];

  @override
  Future<BehaviourBadge> addBadge(BehaviourBadge badge) async => BehaviourBadge.fromJson(_db.add(_badges, badge.toJson(), prepend: false));

  @override
  Stream<void> watch() => _db.watch({_logs, _badges});
}
