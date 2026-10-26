import '../models/school_models.dart';

/// Shared school data every module reads: the teacher, their classes and students.
abstract class ISchoolRepository {
  Future<Teacher> getTeacher();
  Future<void> updateTeacher(Teacher teacher);
  Future<List<SchoolClass>> getClasses();
  Future<List<Student>> getStudents({String? classId});
  Future<Student?> getStudent(String id);

  /// Emits when any of the above changes.
  Stream<void> watch();
}
