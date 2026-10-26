import '../models/homework_models.dart';

abstract class IHomeworkRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<List<Homework>> watchHomework(String childId);
}
