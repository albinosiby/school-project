import '../../../utils/services/data_store.dart';
import '../models/circular_models.dart';
import 'circulars_repository_interface.dart';

class LocalCircularsRepository implements ICircularsRepository {
  LocalCircularsRepository(this._db);
  final DataStore _db;
  static const _c = 'att_circulars';

  @override
  Future<List<Circular>> getAll() async => [for (final r in _db.list(_c)) Circular.fromJson(r)];

  @override
  Future<Circular?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : Circular.fromJson(r);
  }

  @override
  Future<void> markRead(String id) async {
    if (_db.byId(_c, id)?['read'] == false) _db.update(_c, id, {'read': true});
  }

  @override
  Future<void> acknowledge(String id) async => _db.update(_c, id, {'ack': true, 'read': true, 'ackAt': DateTime.now().toIso8601String()});

  @override
  Future<void> setPinned(String id, bool pinned) async => _db.update(_c, id, {'pinned': pinned});

  @override
  Stream<void> watch() => _db.watch({_c});
}
