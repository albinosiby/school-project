import '../../../utils/services/data_store.dart';
import '../models/homework_models.dart';
import 'homework_repository_interface.dart';

class LocalHomeworkRepository implements IHomeworkRepository {
  LocalHomeworkRepository(this._db);
  final DataStore _db;
  static const _c = 'tk_homework';

  @override
  Future<List<Homework>> getAll({String? classId}) async =>
      [for (final r in _db.list(_c)) if (classId == null || r['classId'] == classId) Homework.fromJson(r)];

  @override
  Future<Homework?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : Homework.fromJson(r);
  }

  @override
  Future<Homework> create(Homework homework) async {
    var hw = homework;
    if (hw.submissions.isEmpty) {
      final ids = [for (final s in _db.list('students')) if (s['classId'] == hw.classId) s['id'] as String];
      hw = hw.copyWith(submissions: {for (final id in ids) id: const Submission()});
    }
    final json = hw.toJson();
    if (hw.id.isEmpty) json.remove('id');
    return Homework.fromJson(_db.add(_c, json));
  }

  @override
  Future<void> update(Homework homework) async => _db.update(_c, homework.id, homework.toJson());

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Stream<void> watch() => _db.watch({_c, 'students'});
}
