import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

const trendRanges = ['This Week', 'This Month', 'Term 1', 'Term 2'];
const trendTarget = 90.0;

({String from, String to}) rangeOf(String r) {
  final t = todayDate();
  return switch (r) {
    'This Week' => (from: dkey(t.subtract(Duration(days: t.weekday - 1))), to: dkey(t)),
    'This Month' => (from: dkey(DateTime(t.year, t.month, 1)), to: dkey(t)),
    'Term 1' => (from: '2000-01-01', to: dkey(t.subtract(const Duration(days: 43)))),
    _ => (from: dkey(t.subtract(const Duration(days: 42))), to: dkey(t)),
  };
}

class TrendsState extends Equatable {
  const TrendsState({
    this.policyVersion = '',
    this.status = LoadStatus.initial,
    this.classes = const [],
    this.classId = '',
    this.range = 'This Month',
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
  List<AttendanceRecord> get records => [
    for (final r in history)
      if (r.date.compareTo(window.from) >= 0 && r.date.compareTo(window.to) <= 0) r,
  ];
  double get avg => averageRate(records);
  Map<String, double> get rates {
    final recs = records;
    return {for (final s in roster) s.id: studentRate(recs, s.id, admissionDate: s.admissionDate)};
  }

  List<Student> get atRisk {
    final r = rates;
    return [
      for (final s in roster)
        if (r[s.id]! < minimumAttendance) s,
    ]..sort((a, b) => r[a.id]!.compareTo(r[b.id]!));
  }

  int get perfect => rates.values.where((v) => v >= 100).length;

  /// Mon..Fri average rate (null when no data).
  List<double?> get weekdays {
    final sums = List.filled(5, 0.0), cnts = List.filled(5, 0);
    for (final r in records) {
      final wd = DateTime.parse(r.date).weekday - 1;
      if (wd < 5) {
        sums[wd] += r.rate;
        cnts[wd]++;
      }
    }
    return [for (var i = 0; i < 5; i++) cnts[i] == 0 ? null : sums[i] / cnts[i]];
  }

  ({int? lo, int? hi}) get extremes {
    final wk = weekdays;
    final have = [
      for (var i = 0; i < 5; i++)
        if (wk[i] != null) i,
    ];
    if (have.isEmpty) return (lo: null, hi: null);
    return (lo: have.reduce((a, b) => wk[a]! <= wk[b]! ? a : b), hi: have.reduce((a, b) => wk[a]! >= wk[b]! ? a : b));
  }

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
