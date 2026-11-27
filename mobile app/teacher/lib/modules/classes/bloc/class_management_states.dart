import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../../school/models/school_models.dart';
import '../models/class_management_models.dart';

enum ClassManagementStatus { initial, loading, loaded }

/// One school day of the class across every period marked that day (all subjects): period-marks summed.
typedef ClassDay = ({String date, int periods, int present, int late, int absent, int excused, int total, Set<String> absentees});

extension ClassDayRate on ClassDay {
  /// Present or late, out of every period-mark of the day.
  double get rate => total == 0 ? 0 : (present + late) * 100 / total;
}

/// A student's standing in the class: attendance and marks averages.
typedef StudentStanding = ({Student student, double attendance, double? marks, int absences});

/// Everything the class management page shows, computed from real registers, marks, leave requests and the class
/// timetable.
class ClassManagementState extends Equatable {
  ClassManagementState({
    this.status = ClassManagementStatus.initial,
    this.classId = '',
    this.roster = const [],
    this.records = const [],
    this.leaves = const [],
    this.timetable = const [],
    this.marks = const [],
    this.notice,
    this.noticeSeq = 0,
  });
  final ClassManagementStatus status;
  final String classId;
  final List<Student> roster;

  /// Every submitted register of the class (all periods), oldest first.
  final List<AttendanceRecord> records;
  final List<LeaveSlip> leaves;
  final List<ClassPeriod> timetable;
  final List<ClassMark> marks;
  final String? notice;
  final int noticeSeq;

  // ---- attendance ----------------------------------------------------------

  /// Every day with at least one register, all its periods (subjects) combined, oldest first.
  late final List<ClassDay> days = () {
    final by = <String, List<AttendanceRecord>>{};
    for (final r in records) {
      by.putIfAbsent(r.date, () => []).add(r);
    }
    return [
      for (final e in by.entries)
        () {
          var p = 0, l = 0, a = 0, x = 0, t = 0;
          final absentees = <String>{};
          for (final r in e.value) {
            final c = r.counts;
            p += c.present;
            l += c.late;
            a += c.absent;
            x += c.excused;
            t += c.total;
            for (final m in r.marks.entries) {
              if (m.value == 'A') absentees.add(m.key);
            }
          }
          return (date: e.key, periods: e.value.length, present: p, late: l, absent: a, excused: x, total: t, absentees: absentees);
        }(),
    ]..sort((a, b) => a.date.compareTo(b.date));
  }();

  /// Class attendance over every period-mark recorded (all subjects).
  double get attendanceRate {
    var ok = 0, all = 0;
    for (final d in days) {
      ok += d.present + d.late;
      all += d.total;
    }
    return all == 0 ? 0 : ok * 100 / all;
  }

  /// Subject of a register: the class timetable's period on that weekday, else "Period n".
  String subjectOf(AttendanceRecord r) {
    final d = DateTime.tryParse(r.date);
    final p = d == null ? null : timetable.where((x) => x.day == d.weekday && x.period == r.period).firstOrNull;
    return p == null || p.subject.isEmpty ? 'Period ${r.period}' : p.subject;
  }

  /// Every subject of the class: the timetable's (most periods a week first), then any that only appear in marks
  /// or registers.
  late final List<String> subjects = () {
    final weekly = <String, int>{};
    for (final p in timetable) {
      if (p.subject.isNotEmpty) weekly[p.subject] = (weekly[p.subject] ?? 0) + 1;
    }
    final out = (weekly.keys.toList()..sort((a, b) => weekly[b] != weekly[a] ? weekly[b]!.compareTo(weekly[a]!) : a.compareTo(b)));
    for (final m in marks) {
      if (m.subject.isNotEmpty && !out.contains(m.subject)) out.add(m.subject);
    }
    for (final r in records) {
      final s = subjectOf(r);
      if (!out.contains(s)) out.add(s);
    }
    return out;
  }();

  /// Periods on the class timetable for the weekday of [date] (0 when the timetable has none).
  int scheduledOn(String date) {
    final d = DateTime.tryParse(date);
    return d == null ? 0 : timetable.where((p) => p.day == d.weekday).length;
  }

  /// "1 of 6 periods marked", or "3 periods marked" without a timetable for that day.
  String markedLabel(ClassDay d) {
    final planned = scheduledOn(d.date);
    return planned > d.periods ? '${d.periods} of $planned periods marked' : '${d.periods} ${d.periods == 1 ? 'period' : 'periods'} marked';
  }

  /// Periods of [subject] in the class timetable each week.
  int weeklyPeriods(String subject) => timetable.where((p) => p.subject == subject).length;

  /// Registers recorded for each subject.
  late final Map<String, int> subjectRegisters = () {
    final n = <String, int>{};
    for (final r in records) {
      final s = subjectOf(r);
      n[s] = (n[s] ?? 0) + 1;
    }
    return n;
  }();

  /// Class attendance per subject (average register rate) for every subject; null where no register exists yet.
  late final Map<String, double?> subjectAttendance = () {
    final sums = <String, double>{};
    for (final r in records) {
      final s = subjectOf(r);
      sums[s] = (sums[s] ?? 0) + r.rate;
    }
    return {for (final s in subjects) s: sums.containsKey(s) ? sums[s]! / subjectRegisters[s]! : null};
  }();

  /// A student's attendance per subject: periods attended (present or late) out of periods recorded.
  Map<String, ({int attended, int total})> studentSubjectAttendance(Student s) {
    final out = {for (final k in subjects) k: (attended: 0, total: 0)};
    for (final r in records) {
      if (s.admissionDate.isNotEmpty && r.date.compareTo(s.admissionDate) < 0) continue;
      final k = subjectOf(r);
      final code = r.codeOf(s.id);
      final cur = out[k] ?? (attended: 0, total: 0);
      out[k] = (attended: cur.attended + (code == AttCode.present || code == AttCode.late ? 1 : 0), total: cur.total + 1);
    }
    return out;
  }

  /// Class rate of each recorded day in [month] ("yyyy-MM").
  Map<String, double> dayRates(String month) => {
    for (final d in days)
      if (d.date.startsWith(month)) d.date: d.rate,
  };

  // ---- marks ---------------------------------------------------------------

  List<ClassMark> get scored => [for (final m in marks) if (m.pct != null) m];

  /// Class average per subject (%), for every subject; null where no mark is entered yet.
  late final Map<String, double?> subjectMarks = () {
    final sums = <String, double>{}, n = <String, int>{};
    for (final m in scored) {
      sums[m.subject] = (sums[m.subject] ?? 0) + m.pct!;
      n[m.subject] = (n[m.subject] ?? 0) + 1;
    }
    return {for (final s in subjects) s: sums.containsKey(s) ? sums[s]! / n[s]! : null};
  }();

  double? get marksAverage {
    final s = scored;
    return s.isEmpty ? null : s.map((m) => m.pct!).reduce((a, b) => a + b) / s.length;
  }

  /// Exams in order (by date, then name) with the class average of each.
  late final List<({String exam, String cycleId, double avg})> examAverages = () {
    final by = <String, List<ClassMark>>{};
    for (final m in scored) {
      by.putIfAbsent(m.cycleId.isEmpty ? m.exam : m.cycleId, () => []).add(m);
    }
    final rows = [
      for (final e in by.entries)
        (
          exam: e.value.first.exam,
          cycleId: e.key,
          date: e.value.map((m) => m.date).fold('', (a, b) => b.compareTo(a) > 0 ? b : a),
          avg: e.value.map((m) => m.pct!).reduce((a, b) => a + b) / e.value.length,
        ),
    ]..sort((a, b) => a.date != b.date ? a.date.compareTo(b.date) : a.exam.compareTo(b.exam));
    return [for (final r in rows) (exam: r.exam, cycleId: r.cycleId, avg: r.avg)];
  }();

  /// A student's average per exam (same order as [examAverages]).
  List<({String exam, double? avg})> studentExamProgress(String studentId) => [
    for (final e in examAverages)
      () {
        final mine = [for (final m in scored) if (m.studentId == studentId && (m.cycleId.isEmpty ? m.exam : m.cycleId) == e.cycleId) m.pct!];
        return (exam: e.exam, avg: mine.isEmpty ? null : mine.reduce((a, b) => a + b) / mine.length);
      }(),
  ];

  /// A student's marks per subject, in exam order.
  Map<String, List<ClassMark>> studentSubjectMarks(String studentId) {
    final order = {for (var i = 0; i < examAverages.length; i++) examAverages[i].cycleId: i};
    final out = <String, List<ClassMark>>{};
    for (final m in marks) {
      if (m.studentId == studentId) out.putIfAbsent(m.subject, () => []).add(m);
    }
    for (final l in out.values) {
      l.sort((a, b) => (order[a.cycleId.isEmpty ? a.exam : a.cycleId] ?? 0).compareTo(order[b.cycleId.isEmpty ? b.exam : b.cycleId] ?? 0));
    }
    return out;
  }

  // ---- students ------------------------------------------------------------

  /// Every student's attendance (every period marked since admission, all subjects) and marks average, in roll order.
  late final List<StudentStanding> standings = [
    for (final s in roster)
      () {
        final recs = [for (final r in records) if (s.admissionDate.isEmpty || r.date.compareTo(s.admissionDate) >= 0) r];
        final ok = recs.where((r) {
          final c = r.codeOf(s.id);
          return c == AttCode.present || c == AttCode.late;
        }).length;
        final mine = [for (final m in scored) if (m.studentId == s.id) m.pct!];
        return (
          student: s,
          attendance: recs.isEmpty ? s.attendance : ok * 100 / recs.length,
          marks: mine.isEmpty ? null : mine.reduce((a, b) => a + b) / mine.length,
          // days with at least one absent period
          absences: {for (final r in recs) if (r.codeOf(s.id) == AttCode.absent) r.date}.length,
        );
      }(),
  ];

  StudentStanding? standingOf(String id) => standings.where((x) => x.student.id == id).firstOrNull;

  /// Students by marks average band: <40, 40-60, 60-75, 75-90, 90+.
  List<int> get marksBands {
    final b = List.filled(5, 0);
    for (final s in standings) {
      final m = s.marks;
      if (m == null) continue;
      b[m < 40 ? 0 : m < 60 ? 1 : m < 75 ? 2 : m < 90 ? 3 : 4]++;
    }
    return b;
  }

  List<StudentStanding> get topPerformers =>
      ([for (final s in standings) if (s.marks != null) s]..sort((a, b) => b.marks!.compareTo(a.marks!))).take(3).toList();

  /// Below the attendance minimum or under 40% in marks, weakest first.
  List<StudentStanding> get needsSupport => [
    for (final s in standings)
      if ((records.isNotEmpty && s.attendance < minimumAttendance) || (s.marks != null && s.marks! < 40)) s,
  ]..sort((a, b) => (a.marks ?? a.attendance).compareTo(b.marks ?? b.attendance));

  // ---- leave ---------------------------------------------------------------

  List<LeaveSlip> get pendingLeaves => [for (final l in leaves) if (!l.decided) l]..sort((a, b) => a.from.compareTo(b.from));
  List<LeaveSlip> get decidedLeaves => [for (final l in leaves) if (l.decided) l]..sort((a, b) => (b.decidedAt ?? b.from).compareTo(a.decidedAt ?? a.from));
  Student? studentOf(String id) => roster.where((s) => s.id == id).firstOrNull;

  ClassManagementState copyWith({
    ClassManagementStatus? status,
    String? classId,
    List<Student>? roster,
    List<AttendanceRecord>? records,
    List<LeaveSlip>? leaves,
    List<ClassPeriod>? timetable,
    List<ClassMark>? marks,
    String? notice,
    int? noticeSeq,
  }) => ClassManagementState(
    status: status ?? this.status,
    classId: classId ?? this.classId,
    roster: roster ?? this.roster,
    records: records ?? this.records,
    leaves: leaves ?? this.leaves,
    timetable: timetable ?? this.timetable,
    marks: marks ?? this.marks,
    notice: notice ?? this.notice,
    noticeSeq: noticeSeq ?? this.noticeSeq,
  );

  @override
  List<Object?> get props => [status, classId, roster, records, leaves, timetable, marks, notice, noticeSeq];
}
