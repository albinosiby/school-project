import '../models/lesson_plan_models.dart';

/// Lesson plans (collection `ls_plans`).
abstract class ILessonPlanRepository {
  Future<List<LessonPlan>> getAll();
  Future<LessonPlan?> get(String id);
  /// Creates a plan; an empty [LessonPlan.id] gets a generated one.
  Future<LessonPlan> create(LessonPlan plan);
  Future<void> update(LessonPlan plan);
  Future<void> delete(String id);
  /// Records that the plan link was shared with the HOD / co-teachers.
  Future<void> share(String id);
  Stream<void> watch();
}
