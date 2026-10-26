import '../../../utils/services/data_store.dart';
import '../models/online_test_models.dart';
import 'online_test_repository_interface.dart';

class LocalOnlineTestRepository implements IOnlineTestRepository {
  LocalOnlineTestRepository(this._db);
  final DataStore _db;
  static const _c = 'ts_tests';

  @override
  Future<List<OnlineTest>> getAll() async => [for (final r in _db.list(_c)) OnlineTest.fromJson(r)];

  @override
  Future<OnlineTest?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : OnlineTest.fromJson(r);
  }

  @override
  Future<OnlineTest> create(OnlineTest test) async {
    final json = test.toJson();
    if (test.id.isEmpty) json.remove('id');
    return OnlineTest.fromJson(_db.add(_c, json));
  }

  @override
  Future<void> update(OnlineTest test) async => _db.update(_c, test.id, test.toJson());

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<void> share(String id) async => _db.add('ts_shares', {'testId': id, 'at': DateTime.now().toIso8601String()});

  @override
  Future<void> notify(String text) async => _db.add('ts_notices', {'text': text, 'at': DateTime.now().toIso8601String()});

  @override
  Stream<void> watch() => _db.watch({_c});
}
