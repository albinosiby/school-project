import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../../homework/models/homework_models.dart';
import '../../live_classes/models/live_class_models.dart';
import '../../notices/models/notice_models.dart';
import '../../timetable/models/timetable_models.dart';
import '../../transport/models/transport_models.dart';

/// Everything the Home screen shows for one child.
class HomeSummary extends Equatable {
  const HomeSummary({
    required this.periods,
    required this.attendanceToday,
    required this.isSchoolDay,
    required this.homeworkDue,
    required this.notices,
    required this.nextLiveClass,
    this.homeworkInReview = const [],
    this.termAttendance = 0,
    this.gateEntry,
    this.bus,
  });
  final List<Period> periods;
  final AttendanceRecord? attendanceToday;
  final bool isSchoolDay;

  /// Not handed in and due by tomorrow (overdue included), soonest first.
  final List<Homework> homeworkDue;

  /// Handed in and waiting for the teacher's review, newest due first.
  final List<Homework> homeworkInReview;
  final List<Notice> notices;
  final LiveClass? nextLiveClass;

  /// Term attendance percentage (0..100).
  final double termAttendance;
  final GateEntry? gateEntry;
  final BusTrip? bus;

  @override
  List<Object?> get props => [
    periods,
    attendanceToday,
    isSchoolDay,
    homeworkDue,
    homeworkInReview,
    notices,
    nextLiveClass,
    termAttendance,
    gateEntry,
    bus,
  ];
}
