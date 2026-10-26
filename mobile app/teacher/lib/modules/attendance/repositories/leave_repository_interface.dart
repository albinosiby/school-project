import '../models/leave_models.dart';

/// The teacher's own leave: quota, applications and handover data.
abstract class ILeaveRepository {
  Future<List<LeaveQuota>> getQuota();
  /// Newest first.
  Future<List<LeaveApplication>> getApplications();
  Future<LeaveApplication> apply(LeaveApplication application);
  Future<List<HandoverPeriod>> getHandoverPeriods();
  Future<List<Faculty>> getFaculty();
  Stream<void> watch();
}
