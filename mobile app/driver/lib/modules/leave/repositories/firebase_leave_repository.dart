import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/crew_session.dart';
import '../../crew/models/crew_models.dart';
import '../models/leave_models.dart';
import 'leave_repository_interface.dart';

/// `tr_crew_leaves` of the signed-in crew member (contract 14.5).
class FirebaseLeaveRepository implements ILeaveRepository {
  FirebaseLeaveRepository(this._session);
  final CrewSession _session;

  @override
  Stream<List<CrewLeave>> watch() => _session.whenReady(() => _session.col('tr_crew_leaves').where('crewId', isEqualTo: _session.crewId).snapshots().map(
        (q) => [for (final d in q.docs) CrewLeave.fromJson(d.data(), id: d.id)]
          ..sort((a, b) => (b.appliedAt ?? DateTime(0)).compareTo(a.appliedAt ?? DateTime(0))),
      ));

  @override
  Future<CrewLeave> apply({required String type, required String from, required String to, required String reason}) async {
    if (to.compareTo(from) < 0) throw AppException(message: 'The end date is before the start date.');
    final me = _session.me;
    final leave = CrewLeave(
      id: 'lv_${_session.crewId}_${DateTime.now().millisecondsSinceEpoch}', crewId: _session.crewId, name: me?.name ?? '',
      role: _session.role.code, busId: _session.busId, type: type, from: from, to: to, reason: reason, appliedAt: DateTime.now(),
    );
    await _session.col('tr_crew_leaves').doc(leave.id).set({...leave.toJson(), 'updatedAt': nowUtc(), 'updatedBy': _session.uid});
    return leave;
  }

  @override
  Future<void> withdraw(String id) => _session.col('tr_crew_leaves').doc(id).delete();
}
