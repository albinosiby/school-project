import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/duty_models.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';
import '../models/syllabus_models.dart';

enum DutiesStatus { initial, loading, loaded, failure }

class DutiesState extends Equatable {
  const DutiesState({
    this.status = DutiesStatus.initial, this.duties = const [], this.swaps = const [], this.homework = const [], this.students = const [],
    this.classes = const [], this.teacher, this.syllabus = const SyllabusMeta(), this.error,
  });
  final DutiesStatus status;
  final List<Duty> duties;
  final List<SwapRequest> swaps;
  final List<Homework> homework;
  final List<Student> students;
  final List<SchoolClass> classes;
  final Teacher? teacher;
  final SyllabusMeta syllabus;
  final String? error;

  Duty? dutyById(String id) => duties.where((d) => d.id == id).firstOrNull;
  SwapRequest? pendingSwap(String dutyId) => swaps.where((s) => s.dutyId == dutyId && s.isPending).firstOrNull;

  HomeworkStats statsOf(Homework h) => HomeworkStats.of(h, students);

  /// Open homework that still has papers to grade.
  List<Homework> get gradingDeadlines => [for (final h in homework) if (h.status == 'open' && statsOf(h).toGrade > 0) h];

  /// Homework the syllabus progress log is opened from.
  String get progressHomeworkId => homework.isEmpty ? 'none' : homework.first.id;

  /// "Grade 10–A", or '' when the class is unknown.
  String classGrade(String classId) {
    final c = classes.where((c) => c.id == classId).firstOrNull;
    return c == null ? '' : 'Grade ${c.grade}–${c.section}';
  }

  DutiesState copyWith({
    DutiesStatus? status, List<Duty>? duties, List<SwapRequest>? swaps, List<Homework>? homework, List<Student>? students, List<SchoolClass>? classes,
    Teacher? teacher, SyllabusMeta? syllabus, String? error,
  }) =>
      DutiesState(
        status: status ?? this.status, duties: duties ?? this.duties, swaps: swaps ?? this.swaps, homework: homework ?? this.homework,
        students: students ?? this.students, classes: classes ?? this.classes, teacher: teacher ?? this.teacher, syllabus: syllabus ?? this.syllabus, error: error,
      );

  @override
  List<Object?> get props => [status, duties, swaps, homework, students, classes, teacher, syllabus, error];
}
