import '../models/teacher_models.dart';

abstract class ITeachersRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<TeachersData> watchTeachers(String childId);
}
