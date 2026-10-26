import '../../../utils/services/data_store.dart';
import '../models/home_models.dart';
import 'home_repository_interface.dart';

class LocalHomeRepository implements IHomeRepository {
  LocalHomeRepository(this._db);
  final DataStore _db;
  static const _pending = 'hm_pending', _reminders = 'hm_reminders';

  @override
  Future<List<PendingTask>> getPending() async => [for (final r in _db.list(_pending)) PendingTask.fromJson(r)];

  @override
  Future<void> setPendingDone(String id, {bool done = true}) async => _db.update(_pending, id, {'done': done});

  @override
  Future<List<Reminder>> getReminders() async => [for (final r in _db.list(_reminders)) Reminder.fromJson(r)];

  @override
  Stream<void> watch() => _db.watch({_pending, _reminders});
}
