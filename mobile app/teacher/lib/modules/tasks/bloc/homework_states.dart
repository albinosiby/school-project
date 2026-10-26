import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';

enum HomeworkStatus { initial, loading, loaded, notFound, failure }

class HomeworkState extends Equatable {
  const HomeworkState({this.status = HomeworkStatus.initial, this.id = '', this.homework, this.students = const [], this.schoolClass, this.teacher, this.error});
  final HomeworkStatus status;
  final String id;
  final Homework? homework;
  /// Roster of the homework's class.
  final List<Student> students;
  final SchoolClass? schoolClass;
  final Teacher? teacher;
  final String? error;

  HomeworkStats get stats => HomeworkStats.of(homework!, students);
  bool get closed => homework?.status == 'closed';
  String get classLabel => schoolClass == null ? 'General' : 'Class ${schoolClass!.label}';
  String get classGrade => schoolClass == null ? '' : 'Grade ${schoolClass!.grade}–${schoolClass!.section}';
  Student? student(String id) => students.where((s) => s.id == id).firstOrNull;

  HomeworkState copyWith({HomeworkStatus? status, String? id, Homework? homework, List<Student>? students, SchoolClass? schoolClass, Teacher? teacher, String? error}) => HomeworkState(
        status: status ?? this.status, id: id ?? this.id, homework: homework ?? this.homework, students: students ?? this.students,
        schoolClass: schoolClass ?? this.schoolClass, teacher: teacher ?? this.teacher, error: error,
      );

  @override
  List<Object?> get props => [status, id, homework, students, schoolClass, teacher, error];
}
