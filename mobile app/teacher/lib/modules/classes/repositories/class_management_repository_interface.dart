import '../models/class_management_models.dart';

/// Class-wide data the class teacher manages: the division's full timetable and every subject's marks.
abstract class IClassManagementRepository {
  Future<List<ClassPeriod>> getTimetable(String classId);
  Future<List<ClassMark>> getMarks(String classId);
  Stream<void> watch();
}
