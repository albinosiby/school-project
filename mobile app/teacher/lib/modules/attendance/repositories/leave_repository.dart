import '../../../utils/services/data_store.dart';
import '../models/leave_models.dart';
import 'leave_repository_interface.dart';

class LocalLeaveRepository implements ILeaveRepository {
  LocalLeaveRepository(this._db);
  final DataStore _db;
  static const quota = 'att_quota', leaves = 'att_leaves', periods = 'att_periods', faculty = 'att_faculty';

  @override
  Future<List<LeaveQuota>> getQuota() async => [for (final r in _db.list(quota)) LeaveQuota.fromJson(r)];

  @override
  Future<List<LeaveApplication>> getApplications() async => [for (final r in _db.list(leaves)) LeaveApplication.fromJson(r)];

  @override
  Future<LeaveApplication> apply(LeaveApplication application) async => LeaveApplication.fromJson(_db.add(leaves, application.toJson()));

  @override
  Future<List<HandoverPeriod>> getHandoverPeriods() async => [for (final r in _db.list(periods)) HandoverPeriod.fromJson(r)];

  @override
  Future<List<Faculty>> getFaculty() async => [for (final r in _db.list(faculty)) Faculty.fromJson(r)];

  @override
  Stream<void> watch() => _db.watch({quota, leaves, periods, faculty});
}
