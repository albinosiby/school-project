import '../../../utils/services/data_store.dart';
import '../models/syllabus_models.dart';
import 'syllabus_repository_interface.dart';

class LocalSyllabusRepository implements ISyllabusRepository {
  LocalSyllabusRepository(this._db);
  final DataStore _db;
  static const _c = 'tk_syllabus', _meta = 'tk_syllabus_meta';

  @override
  Future<List<SyllabusDivision>> getDivisions() async => [for (final r in _db.list(_c)) SyllabusDivision.fromJson(r)];

  @override
  Future<SyllabusMeta> getMeta() async => SyllabusMeta.fromJson(_db.doc(_meta));

  @override
  Future<bool> logPeriod(String divisionId, int topicIndex) async {
    final r = _db.byId(_c, divisionId);
    if (r == null) return false;
    final d = SyllabusDivision.fromJson(r);
    if (topicIndex < 0 || topicIndex >= d.topics.length || d.topics[topicIndex].isComplete) return false;
    final topics = [
      for (var i = 0; i < d.topics.length; i++)
        i == topicIndex ? SyllabusTopic(d.topics[i].name, d.topics[i].done + 1, d.topics[i].total).toJson() : d.topics[i].toJson(),
    ];
    _db.update(_c, divisionId, {'topics': topics, 'hours': d.hours + 1});
    return true;
  }

  @override
  Future<void> setSubmitted(bool submitted) async =>
      _db.setDoc(_meta, {'status': submitted ? 'submitted' : 'draft', 'submittedAt': submitted ? DateTime.now().toIso8601String() : null});

  @override
  Stream<void> watch() => _db.watch({_c, _meta});
}
