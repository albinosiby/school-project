import '../../../utils/services/data_store.dart';
import '../models/attendance_models.dart';
import 'attendance_repository_interface.dart';

class LocalAttendanceRepository implements IAttendanceRepository {
  LocalAttendanceRepository(this._db);
  final DataStore _db;

  static const records = 'att_records', staff = 'att_staff', regs = 'att_regs', notices = 'att_notices', sched = 'att_sched', slips = 'att_slips', medical = 'att_medical';

  @override
  Future<List<AttendanceRecord>> getRecords({String? classId}) async =>
      [for (final r in _db.list(records)) if (classId == null || r['classId'] == classId) AttendanceRecord.fromJson(r)];

  @override
  Future<AttendanceRecord?> findRecord(String classId, String date, int period) async {
    for (final r in _db.list(records)) {
      if (r['classId'] == classId && r['date'] == date && r['period'] == period) return AttendanceRecord.fromJson(r);
    }
    return null;
  }

  @override
  Future<AttendanceRecord> saveRecord(AttendanceRecord record) async {
    final json = record.toJson();
    if (record.id.isEmpty || _db.byId(records, record.id) == null) {
      if (record.id.isEmpty) json.remove('id');
      return AttendanceRecord.fromJson(_db.add(records, json));
    }
    return AttendanceRecord.fromJson(_db.update(records, record.id, json)!);
  }

  @override
  Future<List<ScheduleSlot>> getSchedule() async => [for (final r in _db.list(sched)) ScheduleSlot.fromJson(r)]..sort((a, b) => a.period.compareTo(b.period));

  @override
  Future<List<StaffLog>> getStaffLogs() async => [for (final r in _db.list(staff)) StaffLog.fromJson(r)];

  @override
  Future<void> punchIn(StaffLog log) async {
    final json = log.toJson();
    if (log.id.isEmpty) json.remove('id');
    _db.add(staff, json);
  }

  @override
  Future<void> punchOut(String id, String time) async => _db.update(staff, id, {'out': time});

  @override
  Future<List<Regularization>> getRegularizations() async => [for (final r in _db.list(regs)) Regularization.fromJson(r)];

  @override
  Future<void> addRegularization(Regularization r) async => _db.add(regs, r.toJson());

  @override
  Future<List<ParentNotice>> getNotices() async => [for (final r in _db.list(notices)) ParentNotice.fromJson(r)];

  @override
  Future<void> addNotice(ParentNotice n) async => _db.add(notices, n.toJson());

  @override
  Future<List<LeaveSlip>> getLeaveSlips() async => [for (final r in _db.list(slips)) LeaveSlip.fromJson(r)];

  @override
  Future<void> setLeaveSlipStatus(String id, String status, {String? note}) async =>
      _db.update(slips, id, {'status': status, 'decisionNote': ?note, 'decidedAt': DateTime.now().toIso8601String()});

  @override
  Future<List<MedicalSlip>> getMedicalSlips() async => [for (final r in _db.list(medical)) MedicalSlip.fromJson(r)];

  @override
  Future<void> decideMedicalSlip(String id, {required bool approved, required String by, String? reason}) async =>
      _db.update(medical, id, {'status': approved ? 'Approved' : 'Rejected', 'by': by, 'reason': ?reason});

  @override
  Future<bool> isExcused(String studentId, String date) async {
    for (final r in [..._db.list(slips), ..._db.list(medical)]) {
      if (r['studentId'] == studentId && r['status'] == 'Approved' && '${r['from']}'.compareTo(date) <= 0 && '${r['to']}'.compareTo(date) >= 0) return true;
    }
    return false;
  }

  @override
  Stream<void> watch() => _db.watch({records, staff, regs, notices, sched, slips, medical});
}
