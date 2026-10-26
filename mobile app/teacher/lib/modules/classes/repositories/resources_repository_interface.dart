import '../models/classes_models.dart';

/// Files shared with a class and the student-portal visibility preference.
abstract class IResourcesRepository {
  Future<List<SharedResource>> getResources({String? classId});
  Future<SharedResource> addResource(SharedResource resource);
  Future<void> updateResource(SharedResource resource);
  Future<void> deleteResource(String id);
  Future<bool> isPortalVisible();
  Future<void> setPortalVisible(bool visible);
  Stream<void> watch();
}
