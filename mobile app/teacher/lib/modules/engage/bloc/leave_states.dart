import 'package:equatable/equatable.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/leave_models.dart';
import 'engage_notice.dart';

class LeaveState extends Equatable implements NoticeState {
  const LeaveState({this.status = EngageStatus.initial, this.myLeaves = const [], this.balances = const [], this.studentLeaves = const [], this.notice, this.error});
  final EngageStatus status;
  final List<MyLeave> myLeaves;
  final List<LeaveBalance> balances;
  final List<StudentLeave> studentLeaves;
  @override
  final Notice? notice;
  final String? error;

  List<MyLeave> get _sorted => [...myLeaves]..sort((a, b) => b.from.compareTo(a.from));

  /// Leaves from today on that are still active.
  List<MyLeave> get upcoming {
    final today = todayIso();
    return _sorted.where((e) => e.from.compareTo(today) >= 0 && e.status != 'Rejected' && e.status != 'Cancelled').toList();
  }

  List<MyLeave> get history {
    final up = upcoming.map((e) => e.id).toSet();
    return _sorted.where((e) => !up.contains(e.id)).toList();
  }

  /// Days of [type] used (approved, completed or pending).
  double used(String type) => myLeaves.where((e) => e.type == type && e.countsAgainstBalance).fold<double>(0, (a, e) => a + e.days);

  int get pendingStudentLeaves => studentLeaves.where((e) => e.pending).length;

  List<StudentLeave> studentLeavesOf(String classId) => studentLeaves.where((e) => e.classId == classId).toList();

  LeaveState copyWith({EngageStatus? status, List<MyLeave>? myLeaves, List<LeaveBalance>? balances, List<StudentLeave>? studentLeaves, Notice? notice, String? error}) => LeaveState(
        status: status ?? this.status, myLeaves: myLeaves ?? this.myLeaves, balances: balances ?? this.balances, studentLeaves: studentLeaves ?? this.studentLeaves,
        notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, myLeaves, balances, studentLeaves, notice, error];
}
