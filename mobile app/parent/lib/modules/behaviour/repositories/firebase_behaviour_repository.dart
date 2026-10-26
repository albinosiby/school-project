import '../../../utils/exceptions/app_exception.dart';
import '../models/behaviour_models.dart';
import 'behaviour_repository_interface.dart';

/// Conduct records stay in the teacher app for now (not shared with parents yet): an empty report.
class FirebaseBehaviourRepository implements IBehaviourRepository {
  @override
  Stream<BehaviourReport> watchReport(String childId) =>
      Stream.value(BehaviourReport(childId: childId, entries: const [], remarks: const [], rank: 0, percentile: '—'));

  @override
  Future<void> acknowledge(String childId, String entryId, {String? note}) async =>
      throw AppException(message: 'Conduct records are not shared through the app yet.');
}
