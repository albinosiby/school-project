import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../../homework/models/homework_models.dart';
import '../../live_classes/models/live_class_models.dart';
import '../../notices/models/notice_models.dart';
import '../../timetable/models/timetable_models.dart';

/// Everything the "Today" screen shows for one child.
class HomeSummary extends Equatable {
  const HomeSummary({
    required this.periods,
    required this.attendanceToday,
    required this.isSchoolDay,
    required this.homeworkDue,
    required this.notices,
    required this.nextLiveClass,
  });
  final List<Period> periods;
  final AttendanceRecord? attendanceToday;
  final bool isSchoolDay;
  final List<Homework> homeworkDue;
  final List<Notice> notices;
  final LiveClass? nextLiveClass;

  @override
  List<Object?> get props => [
    periods,
    attendanceToday,
    isSchoolDay,
    homeworkDue,
    notices,
    nextLiveClass,
  ];
}
