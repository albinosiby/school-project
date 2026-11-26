import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';
import '../../../config/app_config.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

const trendRanges = ['This week', 'This month', 'This term', 'This year'];

/// Previous names of the ranges (kept so an old value still resolves).
const _legacyRanges = {'This Week': 'This week', 'This Month': 'This month', 'Term 1': 'This term', 'Term 2': 'This term'};

/// Date window of a range, up to today: the week from Monday, the month, the published term holding today
/// (else the last 90 days), or the academic year (else the last 365 days).
({String from, String to}) rangeOf(String r, [DateTime? today]) {
  final t = today ?? todayDate();
  final policy = AppConfig.isFirebase ? SchoolPolicyRuntime.current : null;
  DateTime start;
  switch (_legacyRanges[r] ?? r) {
    case 'This week':
      start = t.subtract(Duration(days: t.weekday - 1));
    case 'This term':
      final term = policy?.terms.where((x) => !t.isBefore(x.start) && !t.isAfter(x.end)).firstOrNull;
      start = term?.start ?? t.subtract(const Duration(days: 90));
    case 'This year':
      start = policy?.rangeStart ?? t.subtract(const Duration(days: 365));
    default:
      start = DateTime(t.year, t.month, 1);
  }
  return (from: dkey(start), to: dkey(t));
}

/// The window of the same length right before [w] (for "vs last week / month").
({String from, String to}) previousOf(({String from, String to}) w) {
  final a = DateTime.parse(w.from), b = DateTime.parse(w.to);
  final len = b.difference(a).inDays + 1;
  return (from: dkey(a.subtract(Duration(days: len))), to: dkey(a.subtract(const Duration(days: 1))));
}

/// One student's standing over the range.
typedef StudentTrend = ({Student student, double rate, int absent, int late, int days});

class TrendsState extends Equatable {
  const TrendsState({
    this.policyVersion = '',
    this.status = LoadStatus.initial,
    this.classes = const [],
    this.classId = '',
    this.range = 'This month',
    this.roster = const [],
    this.history = const [],
    this.pendingMedical = const {},
    this.outsideYear = 0,
  });
  final String policyVersion;
  final LoadStatus status;
  final List<SchoolClass> classes;
  final String classId, range;
  final List<Student> roster;

  /// All submitted daily records of the class (oldest first).
  final List<AttendanceRecord> history;

  /// Students with a pending medical slip.
  final Set<String> pendingMedical;

  /// Submitted records of the class dated outside the academic year the dashboard published (not counted anywhere).
  final int outsideYear;

  SchoolClass? get cls => classes.where((c) => c.id == classId).firstOrNull;
  ({String from, String to}) get window => rangeOf(range);
  List<AttendanceRecord> _in(({String from, String to}) w) => [
    for (final r in history)
      if (r.date.compareTo(w.from) >= 0 && r.date.compareTo(w.to) <= 0) r,
  ];

  /// Daily records (one per day) inside the range, oldest first.
  List<AttendanceRecord> get records => _in(window);
  double get avg => averageRate(records);

  /// Average of the same-length window before the range; null when nothing was recorded then.
  double? get previousAvg {
    final p = _in(previousOf(window));
    return p.isEmpty ? null : averageRate(p);
  }

  Map<String, double> get rates {
    final recs = records;
    return {for (final s in roster) s.id: studentRate(recs, s.id, admissionDate: s.admissionDate)};
  }

  /// Every student over the range, lowest attendance first.
  List<StudentTrend> get students {
    final recs = records;
    final r = rates;
    return [
      for (final s in roster)
        (
          student: s,
          rate: r[s.id]!,
          absent: recs.where((x) => x.codeOf(s.id) == AttCode.absent).length,
          late: recs.where((x) => x.codeOf(s.id) == AttCode.late).length,
          days: recs.where((x) => s.admissionDate.isEmpty || x.date.compareTo(s.admissionDate) >= 0).length,
        ),
    ]..sort((a, b) => a.rate != b.rate ? a.rate.compareTo(b.rate) : a.student.roll.compareTo(b.student.roll));
  }

  /// Below the school minimum.
  List<Student> get atRisk => [
    for (final t in students)
      if (t.days > 0 && t.rate < minimumAttendance) t.student,
  ];

  /// At or above the minimum but within 5 points of it.
  List<Student> get nearLimit => [
    for (final t in students)
      if (t.days > 0 && t.rate >= minimumAttendance && t.rate < minimumAttendance + 5) t.student,
  ];

  int get perfect => [
    for (final t in students)
      if (t.days > 0 && t.rate >= 100) t,
  ].length;

  /// Marks over the range: present, late, absent and excused student-days.
  AttCounts get totals {
    var total = 0, p = 0, a = 0, l = 0, e = 0;
    for (final r in records) {
      final c = r.counts;
      total += c.total;
      p += c.present;
      a += c.absent;
      l += c.late;
      e += c.excused;
    }
    return (total: total, present: p, absent: a, late: l, excused: e);
  }

  /// Average rate per school weekday (index = weekday - 1, Mon..Sun); null when that day has no data.
  List<double?> get weekdays {
    final sums = List.filled(7, 0.0), cnts = List.filled(7, 0);
    for (final r in records) {
      final wd = DateTime.parse(r.date).weekday - 1;
      sums[wd] += r.rate;
      cnts[wd]++;
    }
    return [for (var i = 0; i < 7; i++) cnts[i] == 0 ? null : sums[i] / cnts[i]];
  }

  /// Lowest and highest weekday (index into [weekdays]); null without data or with a single day.
  ({int? lo, int? hi}) get extremes {
    final wk = weekdays;
    final have = [
      for (var i = 0; i < 7; i++)
        if (wk[i] != null) i,
    ];
    if (have.length < 2) return (lo: null, hi: null);
    return (lo: have.reduce((a, b) => wk[a]! <= wk[b]! ? a : b), hi: have.reduce((a, b) => wk[a]! >= wk[b]! ? a : b));
  }

  /// Chart points: one per recorded day, oldest first.
  List<({String date, double rate, AttCounts counts})> get trend => [
    for (final r in records) (date: r.date, rate: r.rate, counts: r.counts),
  ];

  TrendsState copyWith({
    LoadStatus? status,
    List<SchoolClass>? classes,
    String? classId,
    String? range,
    List<Student>? roster,
    List<AttendanceRecord>? history,
    Set<String>? pendingMedical,
    int? outsideYear,
  }) => TrendsState(
    policyVersion: SchoolPolicyRuntime.current.version,
    status: status ?? this.status,
    classes: classes ?? this.classes,
    classId: classId ?? this.classId,
    range: range ?? this.range,
    roster: roster ?? this.roster,
    history: history ?? this.history,
    pendingMedical: pendingMedical ?? this.pendingMedical,
    outsideYear: outsideYear ?? this.outsideYear,
  );

  @override
  List<Object?> get props => [policyVersion, status, classes, classId, range, roster, history, pendingMedical, outsideYear];
}
