import '../../../utils/services/data_store.dart';
import '../models/timetable_models.dart';
import 'timetable_repository_interface.dart';

class LocalTimetableRepository implements ITimetableRepository {
  LocalTimetableRepository(this._db);
  final DataStore _db;
  static const _periods = 'tt_periods', _subs = 'tt_subs';

  @override
  Future<List<Period>> getPeriods() async => [for (final r in _db.list(_periods)) Period.fromJson(r)];

  @override
  Future<List<Substitution>> getSubstitutions() async => [for (final r in _db.list(_subs)) Substitution.fromJson(r)];

  @override
  Future<Substitution?> getSubstitution(String id) async {
    final r = _db.byId(_subs, id);
    return r == null ? null : Substitution.fromJson(r);
  }

  @override
  Future<void> setSubstitutionStatus(String id, SubStatus status) async => _db.update(_subs, id, {'status': status.name});

  @override
  Future<void> toggleSubstitutionTask(String id, int index) async {
    final sub = await getSubstitution(id);
    if (sub == null || index < 0 || index >= sub.tasks.length) return;
    final tasks = [for (var i = 0; i < sub.tasks.length; i++) i == index ? sub.tasks[i].copyWith(done: !sub.tasks[i].done) : sub.tasks[i]];
    _db.update(_subs, id, {'tasks': [for (final t in tasks) t.toJson()]});
  }

  @override
  Stream<void> watch() => _db.watch({_periods, _subs});
}
