import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../../school/models/school_models.dart';
import '../../tasks/models/homework_models.dart';

enum ClassHubStatus { initial, loading, loaded }

/// What the Classes tab and a class page show besides the roster: attendance registers, student leave requests and
/// homework of the teacher's classes.
class ClassHubState extends Equatable {
  const ClassHubState({this.status = ClassHubStatus.initial, this.records = const [], this.leaves = const [], this.homework = const []});
  final ClassHubStatus status;
  final List<AttendanceRecord> records;
  final List<LeaveSlip> leaves;
  final List<Homework> homework;

  /// Today's submitted register of [classId] (the latest one when several periods were marked).
  AttendanceRecord? todayOf(String classId) {
    final day = dkey(todayDate());
    AttendanceRecord? best;
    for (final r in records) {
      if (r.classId != classId || r.date != day || !r.submitted) continue;
      if (best == null || r.updatedAt.compareTo(best.updatedAt) > 0) best = r;
    }
    return best;
  }

  /// Leave requests still waiting for the class teacher, oldest first.
  List<LeaveSlip> pendingLeaves(List<Student> roster) {
    final ids = {for (final s in roster) s.id};
    return [for (final l in leaves) if (!l.decided && ids.contains(l.studentId)) l]..sort((a, b) => a.from.compareTo(b.from));
  }

  /// Students of [roster] on approved leave today.
  Set<String> onLeaveToday(List<Student> roster) {
    final day = dkey(todayDate());
    final ids = {for (final s in roster) s.id};
    return {for (final l in leaves) if (l.status == 'Approved' && l.covers(day) && ids.contains(l.studentId)) l.studentId};
  }

  /// Open homework of [classId], soonest due first.
  List<Homework> openHomework(String classId) =>
      [for (final h in homework) if (h.classId == classId && h.status == 'open') h]..sort((a, b) => a.due.compareTo(b.due));

  ClassHubState copyWith({ClassHubStatus? status, List<AttendanceRecord>? records, List<LeaveSlip>? leaves, List<Homework>? homework}) => ClassHubState(
    status: status ?? this.status,
    records: records ?? this.records,
    leaves: leaves ?? this.leaves,
    homework: homework ?? this.homework,
  );

  @override
  List<Object?> get props => [status, records, leaves, homework];
}
