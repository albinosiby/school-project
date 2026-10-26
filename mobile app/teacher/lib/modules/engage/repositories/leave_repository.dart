import '../../../utils/services/data_store.dart';
import '../models/leave_models.dart';
import 'leave_repository_interface.dart';

class LocalLeaveRepository implements ILeaveRepository {
  LocalLeaveRepository(this._db);
  final DataStore _db;
  static const _my = 'lm_my', _balance = 'lm_balance', _student = 'lm_student';

  @override
  Future<List<MyLeave>> getMyLeaves() async => [for (final r in _db.list(_my)) MyLeave.fromJson(r)];

  @override
  Future<List<LeaveBalance>> getBalances() async => [for (final r in _db.list(_balance)) LeaveBalance.fromJson(r)];

  @override
  Future<void> cancelMyLeave(String id) async => _db.update(_my, id, {'status': 'Cancelled'});

  @override
  Future<List<StudentLeave>> getStudentLeaves({String? classId}) async =>
      [for (final r in _db.list(_student)) if (classId == null || r['classId'] == classId) StudentLeave.fromJson(r)];

  @override
  Future<void> decideStudentLeave(String id, {required bool approve, required String processedBy, String note = ''}) async => _db.update(_student, id, {
        'status': (approve ? StudentLeaveStatus.approved : StudentLeaveStatus.rejected).name,
        'processedBy': processedBy,
        'processedAt': DateTime.now().millisecondsSinceEpoch,
        'note': note,
      });

  @override
  Stream<void> watch() => _db.watch({_my, _balance, _student});
}
