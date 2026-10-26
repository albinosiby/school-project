import '../models/homework_models.dart';

/// Homework is owned by the tasks module; the classes module creates homework through this interface.
abstract class IHomeworkRepository {
  Future<List<Homework>> getAll({String? classId});
  Future<Homework?> get(String id);
  /// Creates a homework; when [Homework.submissions] is empty every student of the class starts as pending.
  Future<Homework> create(Homework homework);
  Future<void> update(Homework homework);
  Future<void> delete(String id);
  Stream<void> watch();
}
