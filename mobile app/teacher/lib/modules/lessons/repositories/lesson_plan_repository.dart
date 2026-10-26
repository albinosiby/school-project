import '../../../utils/services/data_store.dart';
import '../models/lesson_plan_models.dart';
import 'lesson_plan_repository_interface.dart';

class LocalLessonPlanRepository implements ILessonPlanRepository {
  LocalLessonPlanRepository(this._db);
  final DataStore _db;
  static const _c = 'ls_plans';

  @override
  Future<List<LessonPlan>> getAll() async => [for (final r in _db.list(_c)) LessonPlan.fromJson(r)];

  @override
  Future<LessonPlan?> get(String id) async {
    final r = _db.byId(_c, id);
    return r == null ? null : LessonPlan.fromJson(r);
  }

  @override
  Future<LessonPlan> create(LessonPlan plan) async {
    final json = plan.toJson();
    if (plan.id.isEmpty) json.remove('id');
    return LessonPlan.fromJson(_db.add(_c, json));
  }

  @override
  Future<void> update(LessonPlan plan) async => _db.update(_c, plan.id, plan.toJson());

  @override
  Future<void> delete(String id) async => _db.remove(_c, id);

  @override
  Future<void> share(String id) async => _db.add('ls_shares', {'planId': id, 'at': DateTime.now().toIso8601String()});

  @override
  Stream<void> watch() => _db.watch({_c});
}
