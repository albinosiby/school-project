import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';

enum HomeworkStatus { initial, loading, loaded, notFound, failure, deleted }

class HomeworkState extends Equatable {
  const HomeworkState({
    this.status = HomeworkStatus.initial,
    this.id = '',
    this.homework,
    this.students = const [],
    this.schoolClass,
    this.teacher,
    this.error,
    this.savedSeq = 0,
  });
  final HomeworkStatus status;
  final String id;
  final Homework? homework;

  /// Roster of the homework's class.
  final List<Student> students;
  final SchoolClass? schoolClass;
  final Teacher? teacher;
  final String? error;

  /// Bumped after each saved grade (the grading sheet moves on).
  final int savedSeq;

  HomeworkStats get stats => HomeworkStats.of(homework!, students);
  bool get closed => homework?.status == 'closed';
  String get classLabel => schoolClass == null ? 'General' : 'Class ${schoolClass!.label}';
  Student? student(String id) => students.where((s) => s.id == id).firstOrNull;

  HomeworkState copyWith({
    HomeworkStatus? status,
    String? id,
    Homework? homework,
    List<Student>? students,
    SchoolClass? schoolClass,
    Teacher? teacher,
    String? error,
    int? savedSeq,
  }) => HomeworkState(
    status: status ?? this.status,
    id: id ?? this.id,
    homework: homework ?? this.homework,
    students: students ?? this.students,
    schoolClass: schoolClass ?? this.schoolClass,
    teacher: teacher ?? this.teacher,
    error: error,
    savedSeq: savedSeq ?? this.savedSeq,
  );

  @override
  List<Object?> get props => [status, id, homework, students, schoolClass, teacher, error, savedSeq];
}
