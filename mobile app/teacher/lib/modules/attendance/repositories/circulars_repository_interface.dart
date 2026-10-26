import '../models/circular_models.dart';

abstract class ICircularsRepository {
  Future<List<Circular>> getAll();
  Future<Circular?> get(String id);
  Future<void> markRead(String id);
  Future<void> acknowledge(String id);
  Future<void> setPinned(String id, bool pinned);
  Stream<void> watch();
}
