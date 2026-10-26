import '../models/behaviour_models.dart';

abstract class IBehaviourRepository {
  /// Cache-first stream of the child's conduct report (re-emits after an acknowledgement).
  Stream<BehaviourReport> watchReport(String childId);

  /// Guardian acknowledges a guidance entry, optionally with a note to the teacher.
  Future<void> acknowledge(String childId, String entryId, {String? note});
}
