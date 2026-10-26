import '../models/classes_models.dart';

/// Class-level data of the classes module: syllabus pacing, roster exports and parent contact logs.
abstract class IClassesRepository {
  Future<List<ClassPacing>> getPacing();
  Future<void> savePacing(ClassPacing pacing);
  /// Records a roster export (PDF/XLS) of [count] students.
  Future<void> logExport(String classId, int count);
  /// Records a call/message to a student's guardian.
  Future<void> logContact(String studentId, String type);
  Stream<void> watch();
}
