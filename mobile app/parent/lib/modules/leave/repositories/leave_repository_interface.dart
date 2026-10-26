import '../models/leave_models.dart';

abstract class ILeaveRepository {
  Stream<List<LeaveRequest>> watchLeaves(String childId);
  Future<LeaveRequest> apply({
    required String childId,
    required DateTime from,
    required DateTime to,
    required String reason,
  });
}
