import '../../../utils/services/data_store.dart';
import '../models/classes_models.dart';
import 'resources_repository_interface.dart';

class LocalResourcesRepository implements IResourcesRepository {
  LocalResourcesRepository(this._db);
  final DataStore _db;
  static const _c = 'cl_resources';

  @override
  Future<List<SharedResource>> getResources({String? classId}) async =>
      [for (final r in _db.list(_c)) if (classId == null || r['classId'] == classId) SharedResource.fromJson(r)];

  @override
  Future<SharedResource> addResource(SharedResource resource) async => SharedResource.fromJson(_db.add(_c, resource.toJson()));

  @override
  Future<void> updateResource(SharedResource resource) async => _db.update(_c, resource.id, resource.toJson());

  @override
  Future<void> deleteResource(String id) async => _db.remove(_c, id);

  @override
  Future<bool> isPortalVisible() async => _db.doc('cl_prefs')['portalVisible'] != false;

  @override
  Future<void> setPortalVisible(bool visible) async => _db.setDoc('cl_prefs', {'portalVisible': visible});

  @override
  Stream<void> watch() => _db.watch({_c, 'cl_prefs'});
}
