import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import 'load_status.dart';

/// Medical slips (1.1.3 View Medical Slips) and student leave slips (1.2.1 View Leave Slip).
class SlipsState extends Equatable {
  const SlipsState({this.status = LoadStatus.initial, this.classes = const [], this.students = const [], this.records = const [], this.medical = const [], this.leaveSlips = const []});
  final LoadStatus status;
  final List<SchoolClass> classes;
  final List<Student> students;
  final List<AttendanceRecord> records;
  final List<MedicalSlip> medical;
  final List<LeaveSlip> leaveSlips;

  Student? student(String id) => students.where((s) => s.id == id).firstOrNull;
  SchoolClass? classOf(Student? s) => s == null ? null : classes.where((c) => c.id == s.classId).firstOrNull;
  LeaveSlip? leaveSlip(String id) => leaveSlips.where((s) => s.id == id).firstOrNull;
  double rateOf(Student s) => studentRate(dailyRecords(records, s.classId), s.id);

  SlipsState copyWith({LoadStatus? status, List<SchoolClass>? classes, List<Student>? students, List<AttendanceRecord>? records, List<MedicalSlip>? medical, List<LeaveSlip>? leaveSlips}) =>
      SlipsState(
        status: status ?? this.status, classes: classes ?? this.classes, students: students ?? this.students, records: records ?? this.records,
        medical: medical ?? this.medical, leaveSlips: leaveSlips ?? this.leaveSlips,
      );

  @override
  List<Object?> get props => [status, classes, students, records, medical, leaveSlips];
}
