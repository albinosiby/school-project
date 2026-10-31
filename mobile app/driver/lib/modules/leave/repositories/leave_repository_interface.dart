import '../models/leave_models.dart';

abstract class ILeaveRepository {
  /// Cache-first: own leave requests, newest first.
  Stream<List<CrewLeave>> watch();
  Future<CrewLeave> apply({required String type, required String from, required String to, required String reason});
  Future<void> withdraw(String id);
}
