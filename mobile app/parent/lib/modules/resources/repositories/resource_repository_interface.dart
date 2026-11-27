import '../models/resource_models.dart';

abstract class IResourceRepository {
  /// Resources the child's class teachers shared with parents, pinned first then newest. Cache-first.
  Stream<List<ClassResource>> watchResources(String childId);
}
