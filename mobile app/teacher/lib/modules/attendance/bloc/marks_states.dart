import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/attendance_models.dart';
import '../models/marks_models.dart';
import 'load_status.dart';

class MarksState extends Equatable {
  const MarksState({this.status = LoadStatus.initial, this.exams = const [], this.marks = const [], this.classes = const [], this.students = const [], this.records = const [], this.examId = '', this.filter = 'All', this.query = '', this.teacherName = ''});
  final LoadStatus status;
  final List<Exam> exams;
  final List<StudentMark> marks;
  final List<SchoolClass> classes;
  final List<Student> students;
  /// Attendance records (for the per-student attendance %).
  final List<AttendanceRecord> records;
  final String examId, filter, query, teacherName;

  Exam? get exam => exams.where((e) => e.id == examId).firstOrNull ?? exams.firstOrNull;
  SchoolClass? classById(String id) => classes.where((c) => c.id == id).firstOrNull;
  List<Student> rosterOf(String classId) => [for (final s in students) if (s.classId == classId) s]..sort((a, b) => a.roll.compareTo(b.roll));
  List<Student> get roster => exam == null ? const [] : rosterOf(exam!.classId);

  Map<String, StudentMark> marksOf(String examId) => {for (final m in marks) if (m.examId == examId) m.studentId: m};
  StudentMark? markOf(String examId, String studentId) => marks.where((m) => m.examId == examId && m.studentId == studentId).firstOrNull;
  ExamStats statsOf(Exam ex) => examStats(ex, [for (final s in rosterOf(ex.classId)) s.id], marksOf(ex.id));

  bool isPending(String examId, String studentId) {
    final m = markOf(examId, studentId);
    return m == null || (m.present && m.marks == null);
  }

  bool isAbsent(String examId, String studentId) => markOf(examId, studentId)?.absent == true;

  /// Roster after the search query and filter.
  List<Student> get shown {
    final ex = exam;
    if (ex == null) return const [];
    final q = query.trim().toLowerCase();
    return roster.where((s) {
      if (q.isNotEmpty && !(s.name.toLowerCase().contains(q) || '${s.roll}'.contains(q))) return false;
      return switch (filter) {
        'Pending' => isPending(ex.id, s.id),
        'Graded' => !isPending(ex.id, s.id) && !isAbsent(ex.id, s.id),
        'Absent' => isAbsent(ex.id, s.id),
        _ => true,
      };
    }).toList();
  }

  double attendanceRate(Student s) => studentRate(dailyRecords(records, s.classId), s.id);

  MarksState copyWith({LoadStatus? status, List<Exam>? exams, List<StudentMark>? marks, List<SchoolClass>? classes, List<Student>? students, List<AttendanceRecord>? records, String? examId, String? filter, String? query, String? teacherName}) =>
      MarksState(
        status: status ?? this.status, exams: exams ?? this.exams, marks: marks ?? this.marks, classes: classes ?? this.classes,
        students: students ?? this.students, records: records ?? this.records, examId: examId ?? this.examId, filter: filter ?? this.filter,
        query: query ?? this.query, teacherName: teacherName ?? this.teacherName,
      );

  @override
  List<Object?> get props => [status, exams, marks, classes, students, records, examId, filter, query, teacherName];
}
