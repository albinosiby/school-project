import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

/// State of the Attendance overview (1.2): today's periods, homeroom stats and pending leave slips.
class OverviewState extends Equatable {
  const OverviewState({this.status = LoadStatus.initial, this.classes = const [], this.students = const [], this.schedule = const [], this.records = const [], this.slips = const []});
  final LoadStatus status;
  final List<SchoolClass> classes;
  final List<Student> students;
  final List<ScheduleSlot> schedule;
  final List<AttendanceRecord> records;
  final List<LeaveSlip> slips;

  SchoolClass? classById(String id) => classes.where((c) => c.id == id).firstOrNull;
  Student? studentById(String id) => students.where((s) => s.id == id).firstOrNull;
  SchoolClass? get home => classes.where((c) => c.classTeacher).firstOrNull ?? classes.firstOrNull;
  List<LeaveSlip> get pendingSlips => [for (final s in slips) if (s.status == 'Pending') s];

  /// Today's record for a scheduled slot.
  AttendanceRecord? recordFor(ScheduleSlot sc) {
    final today = dkey(todayDate());
    return records.where((r) => r.classId == sc.classId && r.date == today && r.period == sc.period).firstOrNull;
  }

  List<AttendanceRecord> homeDaily({String? from, String? to}) => home == null ? const [] : dailyRecords(records, home!.id, from: from, to: to);

  /// Average rate of the homeroom over the last 7 days and the 7 days before.
  ({double overall, double previous}) get homeTrend {
    final t = todayDate();
    final week = homeDaily(from: dkey(t.subtract(const Duration(days: 7))));
    final prev = homeDaily(from: dkey(t.subtract(const Duration(days: 14))), to: dkey(t.subtract(const Duration(days: 8))));
    final overall = averageRate(week);
    return (overall: overall, previous: prev.isEmpty ? overall : averageRate(prev));
  }

  int get belowThreshold {
    final h = home;
    if (h == null) return 0;
    final recs = homeDaily();
    return students.where((s) => s.classId == h.id && studentRate(recs, s.id) < 75).length;
  }

  /// Totals over today's submitted periods; [nowMinutes] decides which unmarked periods have started.
  ({int present, int total, int absent, int unmarked}) todayTotals(int nowMinutes) {
    var present = 0, total = 0, absent = 0, unmarked = 0;
    for (final sc in schedule) {
      final r = recordFor(sc);
      if (r != null && r.submitted) {
        final c = r.counts;
        present += c.present + c.late;
        total += c.total;
        absent += c.absent;
      } else if (mins(periodTimes[sc.period]!.$1) <= nowMinutes) {
        unmarked++;
      }
    }
    return (present: present, total: total, absent: absent, unmarked: unmarked);
  }

  OverviewState copyWith({LoadStatus? status, List<SchoolClass>? classes, List<Student>? students, List<ScheduleSlot>? schedule, List<AttendanceRecord>? records, List<LeaveSlip>? slips}) =>
      OverviewState(
        status: status ?? this.status, classes: classes ?? this.classes, students: students ?? this.students, schedule: schedule ?? this.schedule,
        records: records ?? this.records, slips: slips ?? this.slips,
      );

  @override
  List<Object?> get props => [status, classes, students, schedule, records, slips];
}
