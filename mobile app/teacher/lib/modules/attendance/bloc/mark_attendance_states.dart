import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

class MarkAttendanceState extends Equatable {
  const MarkAttendanceState({
    this.status = LoadStatus.initial,
    this.classes = const [],
    this.classId = '',
    this.period = 3,
    this.date = '',
    this.roster = const [],
    this.marks = const {},
    this.existing,
    this.history = const [],
    this.staffToday,
    this.empId = '',
    this.notified = const {},
  });

  final LoadStatus status;
  final List<SchoolClass> classes;
  final String classId, date, empId;
  final int period;
  /// Roster sorted by roll number.
  final List<Student> roster;
  /// studentId -> code being edited.
  final Map<String, AttCode> marks;
  /// The stored record for class + date + period, if any.
  final AttendanceRecord? existing;
  /// Submitted daily records of the class (oldest first).
  final List<AttendanceRecord> history;
  final StaffLog? staffToday;
  /// Students whose parents already got the automated welfare SMS.
  final Set<String> notified;

  SchoolClass? get cls => classes.where((c) => c.id == classId).firstOrNull;
  bool get saved => existing != null;
  bool get submitted => existing?.submitted == true;

  ({int p, int a, int l, int e}) get counts {
    var p = 0, a = 0, l = 0, e = 0;
    for (final v in marks.values) {
      switch (v) {
        case AttCode.absent:
          a++;
        case AttCode.late:
          l++;
        case AttCode.excused:
          e++;
        case AttCode.present:
          p++;
      }
    }
    return (p: p, a: a, l: l, e: e);
  }

  double rateOf(String studentId) => studentRate(history, studentId);

  /// Students absent on each of the last 3 recorded days before [date].
  List<Student> get streak {
    final before = [for (final r in history) if (r.date.compareTo(date) < 0) r];
    if (before.length < 3) return const [];
    final last = before.reversed.take(3).toList();
    return [for (final s in roster) if (last.every((r) => r.codeOf(s.id) == AttCode.absent)) s];
  }

  MarkAttendanceState copyWith({
    LoadStatus? status, List<SchoolClass>? classes, String? classId, int? period, String? date, List<Student>? roster, Map<String, AttCode>? marks,
    AttendanceRecord? Function()? existing, List<AttendanceRecord>? history, StaffLog? Function()? staffToday, String? empId, Set<String>? notified,
  }) =>
      MarkAttendanceState(
        status: status ?? this.status, classes: classes ?? this.classes, classId: classId ?? this.classId, period: period ?? this.period,
        date: date ?? this.date, roster: roster ?? this.roster, marks: marks ?? this.marks, existing: existing == null ? this.existing : existing(),
        history: history ?? this.history, staffToday: staffToday == null ? this.staffToday : staffToday(), empId: empId ?? this.empId,
        notified: notified ?? this.notified,
      );

  @override
  List<Object?> get props => [status, classes, classId, period, date, roster, marks, existing, history, staffToday, empId, notified];
}
