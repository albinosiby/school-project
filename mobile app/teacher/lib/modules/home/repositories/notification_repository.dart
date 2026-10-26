import '../../../utils/services/data_store.dart';
import '../models/notification_models.dart';
import 'notification_repository_interface.dart';

class LocalNotificationRepository implements INotificationRepository {
  LocalNotificationRepository(this._db);
  final DataStore _db;
  static const _c = 'notifications';

  @override
  Future<List<AppNotification>> getAll() async => [for (final r in _db.list(_c)) AppNotification.fromJson(r)]..sort((a, b) => b.at.compareTo(a.at));

  @override
  Future<void> markRead(String id, {bool read = true}) async => _db.update(_c, id, {'read': read});

  @override
  Future<void> markAllRead() async {
    for (final r in _db.list(_c).where((r) => r['read'] != true).toList()) {
      _db.update(_c, r['id'] as String, {'read': true});
    }
  }

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<int> deleteRead() async {
    final ids = [for (final r in _db.list(_c)) if (r['read'] == true) r['id'] as String];
    for (final id in ids) {
      _db.remove(_c, id);
    }
    return ids.length;
  }

  @override
  Future<void> add(AppNotification n) async {
    final j = n.toJson();
    if (n.id.isEmpty) j.remove('id');
    _db.add(_c, j);
  }

  @override
  Stream<void> watch() => _db.watch({_c});
}
