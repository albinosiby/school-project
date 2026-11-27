import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

class MarkAttendanceState extends Equatable {
  const MarkAttendanceState({
    this.policyVersion = '',
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
    this.saveError,
    this.taught = const {},
    this.marked = const {},
  });

  final String policyVersion;
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

  /// Weekday (1-7) -> periods the teacher takes this class on her timetable.
  final Map<int, List<int>> taught;

  /// Submitted registers of this class as "date|period".
  final Set<String> marked;

  /// The teacher's periods of [date] (yyyy-MM-dd) in this class that have begun and have no submitted register.
  /// Only school days from [flagsFrom] up to now count.
  List<int> missingOn(String date, {required DateTime now, required DateTime flagsFrom, required List<int> workingDays}) {
    final d = DateTime.tryParse(date);
    if (d == null || d.isBefore(DateTime(flagsFrom.year, flagsFrom.month, flagsFrom.day)) || !workingDays.contains(d.weekday)) return const [];
    final today = DateTime(now.year, now.month, now.day);
    if (d.isAfter(today)) return const [];
    final nowMin = now.hour * 60 + now.minute;
    return [
      for (final p in taught[d.weekday] ?? const <int>[])
        if (!marked.contains('$date|$p') && (d.isBefore(today) || _startMin(p) <= nowMin)) p,
    ];
  }

  static int _startMin(int period) {
    final t = periodTimes[period]?.$1 ?? '00:00';
    final p = t.split(':');
    return (int.tryParse(p[0]) ?? 0) * 60 + (int.tryParse(p.length > 1 ? p[1] : '0') ?? 0);
  }

  /// Why the last save was refused (period outside the bell schedule, record owned by another teacher); null after a save.
  final String? saveError;

  SchoolClass? get cls => classes.where((c) => c.id == classId).firstOrNull;
  bool get saved => existing != null;
  bool get submitted => existing?.submitted == true;

  /// True when the marks on screen differ from the stored record (or nothing is stored yet): what Save and Update act on.
  bool get dirty {
    final rec = existing;
    if (rec == null) return marks.isNotEmpty;
    return roster.any((s) => (marks[s.id] ?? AttCode.present) != rec.codeOf(s.id));
  }

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

  double rateOf(String studentId) =>
      studentRate(history, studentId, admissionDate: roster.where((s) => s.id == studentId).firstOrNull?.admissionDate);

  /// Students absent on each of the last 3 recorded days before [date].
  List<Student> get streak {
    final before = [
      for (final r in history)
        if (r.date.compareTo(date) < 0) r,
    ];
    if (before.length < 3) return const [];
    final last = before.reversed.take(3).toList();
    return [
      for (final s in roster)
        if (last.every((r) => r.codeOf(s.id) == AttCode.absent)) s,
    ];
  }

  MarkAttendanceState copyWith({
    LoadStatus? status,
    List<SchoolClass>? classes,
    String? classId,
    int? period,
    String? date,
    List<Student>? roster,
    Map<String, AttCode>? marks,
    AttendanceRecord? Function()? existing,
    List<AttendanceRecord>? history,
    StaffLog? Function()? staffToday,
    String? empId,
    Set<String>? notified,
    String? Function()? saveError,
    Map<int, List<int>>? taught,
    Set<String>? marked,
  }) => MarkAttendanceState(
    policyVersion: SchoolPolicyRuntime.current.version,
    status: status ?? this.status,
    classes: classes ?? this.classes,
    classId: classId ?? this.classId,
    period: period ?? this.period,
    date: date ?? this.date,
    roster: roster ?? this.roster,
    marks: marks ?? this.marks,
    existing: existing == null ? this.existing : existing(),
    history: history ?? this.history,
    staffToday: staffToday == null ? this.staffToday : staffToday(),
    empId: empId ?? this.empId,
    notified: notified ?? this.notified,
    saveError: saveError == null ? this.saveError : saveError(),
    taught: taught ?? this.taught,
    marked: marked ?? this.marked,
  );

  @override
  List<Object?> get props => [
    policyVersion,
    status,
    classes,
    classId,
    period,
    date,
    roster,
    marks,
    existing,
    history,
    staffToday,
    empId,
    notified,
    taught,
    marked,
    saveError,
  ];
}
