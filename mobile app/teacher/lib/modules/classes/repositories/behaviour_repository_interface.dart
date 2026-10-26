import '../models/classes_models.dart';

/// Conduct records (praise, guidance flags, pastoral notes) and the badge catalogue.
abstract class IBehaviourRepository {
  Future<List<BehaviourLog>> getLogs({String? classId, String? studentId});
  Future<BehaviourLog> addLog(BehaviourLog log);
  Future<void> updateLog(BehaviourLog log);
  Future<void> deleteLog(String id);
  Future<List<BehaviourBadge>> getBadges();
  Future<BehaviourBadge> addBadge(BehaviourBadge badge);
  Stream<void> watch();
}
