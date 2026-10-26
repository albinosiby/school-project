import '../models/task_models.dart';

/// Teacher tasks & reminders (`tk_tasks`).
abstract class ITaskRepository {
  Future<List<TaskItem>> getAll();
  Future<TaskItem?> get(String id);
  /// Creates a pending task; an empty [TaskItem.id] gets a generated id.
  Future<TaskItem> create(TaskItem task);
  /// Saves the editable fields (title, kind, category, priority, class, due, notify, notes).
  Future<void> update(TaskItem task);
  Future<void> delete(String id);
  /// Marks done (stamps doneAt) or reopens.
  Future<void> setDone(String id, bool done);
  /// Records a simulated parent call/message on a follow-up task.
  Future<void> recordContact(String id, String kind);
  /// Saves evaluation progress; completes the task when every paper is reviewed.
  Future<void> saveReview(String id, int reviewed);
  Stream<void> watch();
}
