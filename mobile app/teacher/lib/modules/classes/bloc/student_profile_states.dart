import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/models/marks_models.dart';
import '../../tasks/models/homework_models.dart';
import '../models/class_management_models.dart';
import '../models/classes_models.dart';
import '../models/student_details.dart';

enum ProfileStatus { initial, loading, loaded }

/// One exam the teacher can see with this student's result.
typedef ExamResult = ({Exam exam, StudentMark? mark});

class StudentProfileState extends Equatable {
  const StudentProfileState({
    this.status = ProfileStatus.initial,
    this.studentId = '',
    this.classId = '',
    this.records = const [],
    this.periods = const [],
    this.timetable = const [],
    this.homework = const [],
    this.exams = const [],
    this.logs = const [],
    this.leaves = const [],
    this.details,
    this.detailsLoading = false,
    this.detailsError,
    this.saving = false,
    this.saveError,
    this.savedSeq = 0,
  });
  final ProfileStatus status;
  final String studentId, classId;

  /// Submitted registers of the class (one per day: the latest period), oldest first.
  final List<AttendanceRecord> records;

  /// Every submitted register of the class since admission (all periods / subjects), oldest first.
  final List<AttendanceRecord> periods;

  /// The class timetable (any subject / teacher).
  final List<ClassPeriod> timetable;
  final List<Homework> homework;
  final List<ExamResult> exams;
  final List<BehaviourLog> logs;
  final List<LeaveSlip> leaves;
  final StudentDetails? details;
  final bool detailsLoading, saving;
  final String? detailsError, saveError;

  /// Bumped after every successful save (the edit sheet closes on it).
  final int savedSeq;

  /// Days this student was marked, by code.
  ({int days, int present, int absent, int late, int excused}) get attendance {
    var p = 0, a = 0, l = 0, e = 0;
    for (final r in records) {
      switch (r.codeOf(studentId)) {
        case AttCode.absent:
          a++;
        case AttCode.late:
          l++;
        case AttCode.excused:
          e++;
        default:
          p++;
      }
    }
    return (days: records.length, present: p, absent: a, late: l, excused: e);
  }

  double get attendanceRate {
    final a = attendance;
    return a.days == 0 ? 0 : (a.present + a.late) * 100 / a.days;
  }

  /// Code of [date] ('' when no register was submitted that day).
  String codeOn(String date) {
    final r = records.where((x) => x.date == date).firstOrNull;
    return r == null ? '' : r.codeOf(studentId).name;
  }

  /// The periods of [date] in order: the timetable's for that weekday plus any other period marked that day, each
  /// with its subject, teacher and this student's mark ([code] null = not marked yet).
  List<({int period, String subject, String teacher, AttCode? code})> slotsOn(String date) {
    final d = DateTime.tryParse(date);
    if (d == null) return const [];
    final regs = {for (final r in periods) if (r.date == date) r.period: r};
    final planned = {for (final p in timetable) if (p.day == d.weekday) p.period: p};
    final nums = {...planned.keys, ...regs.keys}.toList()..sort();
    return [
      for (final n in nums)
        (
          period: n,
          subject: planned[n]?.subject.isNotEmpty == true ? planned[n]!.subject : 'Period $n',
          teacher: planned[n]?.teacher ?? '',
          code: regs[n]?.codeOf(studentId),
        ),
    ];
  }

  /// Most recent absences first.
  List<AttendanceRecord> get absences => [for (final r in records.reversed) if (r.codeOf(studentId) == AttCode.absent) r];

  StudentProfileState copyWith({
    ProfileStatus? status,
    String? studentId,
    String? classId,
    List<AttendanceRecord>? records,
    List<AttendanceRecord>? periods,
    List<ClassPeriod>? timetable,
    List<Homework>? homework,
    List<ExamResult>? exams,
    List<BehaviourLog>? logs,
    List<LeaveSlip>? leaves,
    StudentDetails? Function()? details,
    bool? detailsLoading,
    String? Function()? detailsError,
    bool? saving,
    String? Function()? saveError,
    int? savedSeq,
  }) => StudentProfileState(
    status: status ?? this.status,
    studentId: studentId ?? this.studentId,
    classId: classId ?? this.classId,
    records: records ?? this.records,
    periods: periods ?? this.periods,
    timetable: timetable ?? this.timetable,
    homework: homework ?? this.homework,
    exams: exams ?? this.exams,
    logs: logs ?? this.logs,
    leaves: leaves ?? this.leaves,
    details: details != null ? details() : this.details,
    detailsLoading: detailsLoading ?? this.detailsLoading,
    detailsError: detailsError != null ? detailsError() : this.detailsError,
    saving: saving ?? this.saving,
    saveError: saveError != null ? saveError() : this.saveError,
    savedSeq: savedSeq ?? this.savedSeq,
  );

  @override
  List<Object?> get props => [status, studentId, classId, records, periods, timetable, homework, exams, logs, leaves, details, detailsLoading, detailsError, saving, saveError, savedSeq];
}
