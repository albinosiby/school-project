import '../models/timetable_models.dart';

/// Weekly periods and substitution duties.
abstract class ITimetableRepository {
  Future<List<Period>> getPeriods();
  Future<List<Substitution>> getSubstitutions();
  Future<Substitution?> getSubstitution(String id);
  Future<void> setSubstitutionStatus(String id, SubStatus status);
  /// Flips the done flag of task [index] of substitution [id].
  Future<void> toggleSubstitutionTask(String id, int index);
  Stream<void> watch();
}
