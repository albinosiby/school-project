import 'package:equatable/equatable.dart';
import '../models/school_models.dart';

enum SchoolStatus { initial, loading, loaded, failure }

class SchoolState extends Equatable {
  const SchoolState({this.status = SchoolStatus.initial, this.teacher, this.classes = const [], this.students = const [], this.error});
  final SchoolStatus status;
  final Teacher? teacher;
  final List<SchoolClass> classes;
  final List<Student> students;
  final String? error;

  SchoolClass? classById(String id) => classes.where((c) => c.id == id).firstOrNull;
  List<Student> studentsOf(String classId) => students.where((s) => s.classId == classId).toList();

  SchoolState copyWith({SchoolStatus? status, Teacher? teacher, List<SchoolClass>? classes, List<Student>? students, String? error}) => SchoolState(
        status: status ?? this.status, teacher: teacher ?? this.teacher, classes: classes ?? this.classes, students: students ?? this.students, error: error,
      );

  @override
  List<Object?> get props => [status, teacher, classes, students, error];
}
