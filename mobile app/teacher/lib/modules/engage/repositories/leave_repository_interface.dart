import '../models/leave_models.dart';

/// The teacher's own leaves/balances and the student leave requests they review.
abstract class ILeaveRepository {
  Future<List<MyLeave>> getMyLeaves();
  Future<List<LeaveBalance>> getBalances();
  Future<void> cancelMyLeave(String id);
  Future<List<StudentLeave>> getStudentLeaves({String? classId});

  /// Approves or rejects a pending student leave, recording who processed it and when.
  Future<void> decideStudentLeave(String id, {required bool approve, required String processedBy, String note = ''});
  Stream<void> watch();
}
