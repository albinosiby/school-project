import '../models/attendance_models.dart';

/// Class attendance, staff self-log, parent notices and student leave / medical slips.
abstract class IAttendanceRepository {
  Future<List<AttendanceRecord>> getRecords({String? classId});
  Future<AttendanceRecord?> findRecord(String classId, String date, int period);
  /// Inserts (empty id) or replaces a record; returns the stored record.
  Future<AttendanceRecord> saveRecord(AttendanceRecord record);
  Future<List<ScheduleSlot>> getSchedule();

  Future<List<StaffLog>> getStaffLogs();
  Future<void> punchIn(StaffLog log);
  Future<void> punchOut(String id, String time);
  Future<List<Regularization>> getRegularizations();
  Future<void> addRegularization(Regularization r);

  Future<List<ParentNotice>> getNotices();
  Future<void> addNotice(ParentNotice n);

  Future<List<LeaveSlip>> getLeaveSlips();
  Future<void> setLeaveSlipStatus(String id, String status, {String? note});
  Future<List<MedicalSlip>> getMedicalSlips();
  Future<void> decideMedicalSlip(String id, {required bool approved, required String by, String? reason});

  /// True when an approved leave or medical slip covers [studentId] on [date].
  Future<bool> isExcused(String studentId, String date);

  Stream<void> watch();
}
