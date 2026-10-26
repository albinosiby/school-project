import '../../../utils/services/data_store.dart';
import '../models/classes_models.dart';
import 'classes_repository_interface.dart';

class LocalClassesRepository implements IClassesRepository {
  LocalClassesRepository(this._db);
  final DataStore _db;

  @override
  Future<List<ClassPacing>> getPacing() async => [for (final r in _db.list('cl_pacing')) ClassPacing.fromJson(r)];

  @override
  Future<void> savePacing(ClassPacing pacing) async {
    if (_db.byId('cl_pacing', pacing.id) == null) {
      _db.add('cl_pacing', pacing.toJson(), prepend: false);
    } else {
      _db.update('cl_pacing', pacing.id, pacing.toJson());
    }
  }

  @override
  Future<void> logExport(String classId, int count) async =>
      _db.add('cl_exports', {'classId': classId, 'count': count, 'at': DateTime.now().toIso8601String()});

  @override
  Future<void> logContact(String studentId, String type) async =>
      _db.add('cl_contacts', {'studentId': studentId, 'type': type, 'at': DateTime.now().toIso8601String()});

  @override
  Stream<void> watch() => _db.watch({'cl_pacing'});
}
