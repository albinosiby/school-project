import '../../../utils/services/data_store.dart';
import '../models/task_models.dart';
import 'task_repository_interface.dart';

class LocalTaskRepository implements ITaskRepository {
  LocalTaskRepository(this._db);
  final DataStore _db;
  static const _c = 'tk_tasks';

  @override
  Future<List<TaskItem>> getAll() async => [for (final r in _db.list(_c)) TaskItem.fromJson(r)];

  @override
  Future<TaskItem?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : TaskItem.fromJson(r);
  }

  @override
  Future<TaskItem> create(TaskItem task) async {
    final json = task.toJson();
    if (task.id.isEmpty) json.remove('id');
    return TaskItem.fromJson(_db.add(_c, {...json, 'status': 'pending'}));
  }

  @override
  Future<void> update(TaskItem t) async => _db.update(_c, t.id, {
        'title': t.title, 'kind': t.kind, 'category': t.category, 'priority': t.priority, 'classId': t.classId, 'due': t.due, 'notify': t.notify, 'notes': t.notes,
      });

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<void> setDone(String id, bool done) async =>
      _db.update(_c, id, {'status': done ? 'done' : 'pending', 'doneAt': done ? DateTime.now().toIso8601String() : null});

  @override
  Future<void> recordContact(String id, String kind) async =>
      _db.update(_c, id, {'lastContact': kind, 'lastContactAt': DateTime.now().toIso8601String()});

  @override
  Future<void> saveReview(String id, int reviewed) async {
    final total = (_db.byId(_c, id)?['total'] as num?)?.toInt() ?? 0;
    final done = reviewed >= total;
    _db.update(_c, id, {'reviewed': reviewed, 'status': done ? 'done' : 'in_progress', if (done) 'doneAt': DateTime.now().toIso8601String()});
  }

  @override
  Stream<void> watch() => _db.watch({_c});
}
