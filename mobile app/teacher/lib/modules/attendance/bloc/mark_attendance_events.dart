import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';

sealed class MarkAttendanceEvent extends Equatable {
  const MarkAttendanceEvent();
  @override
  List<Object?> get props => [];
}

/// Initial load for [classId] (default: the homeroom class) and [period] (default 3).
class MarkAttendanceLoadRequested extends MarkAttendanceEvent {
  const MarkAttendanceLoadRequested({this.classId, this.period});
  final String? classId;
  final int? period;
  @override
  List<Object?> get props => [classId, period];
}

class MarkAttendanceClassChanged extends MarkAttendanceEvent {
  const MarkAttendanceClassChanged(this.classId);
  final String classId;
  @override
  List<Object?> get props => [classId];
}

class MarkAttendanceDateChanged extends MarkAttendanceEvent {
  const MarkAttendanceDateChanged(this.date);
  final String date;
  @override
  List<Object?> get props => [date];
}

class MarkAttendancePeriodChanged extends MarkAttendanceEvent {
  const MarkAttendancePeriodChanged(this.period);
  final int period;
  @override
  List<Object?> get props => [period];
}

class MarkAttendanceCodeSet extends MarkAttendanceEvent {
  const MarkAttendanceCodeSet(this.studentId, this.code);
  final String studentId;
  final AttCode code;
  @override
  List<Object?> get props => [studentId, code];
}

/// Mark every student with [code] (Mark All Present / Absent).
class MarkAttendanceAllSet extends MarkAttendanceEvent {
  const MarkAttendanceAllSet(this.code);
  final AttCode code;
  @override
  List<Object?> get props => [code];
}

/// Save as draft ([submit] false) or submit.
class MarkAttendanceSaved extends MarkAttendanceEvent {
  const MarkAttendanceSaved({required this.submit});
  final bool submit;
  @override
  List<Object?> get props => [submit];
}

/// Send the welfare SMS for a student with a consecutive-absence streak.
class MarkAttendanceWelfareSmsSent extends MarkAttendanceEvent {
  const MarkAttendanceWelfareSmsSent(this.student);
  final Student student;
  @override
  List<Object?> get props => [student];
}

/// Internal: repository data changed (keeps the unsaved marks).
class MarkAttendanceRefreshed extends MarkAttendanceEvent {
  const MarkAttendanceRefreshed();
}
