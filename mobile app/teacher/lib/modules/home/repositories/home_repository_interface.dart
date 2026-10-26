import '../models/home_models.dart';

/// Home tab data: pending action tasks and duty reminders.
abstract class IHomeRepository {
  Future<List<PendingTask>> getPending();
  Future<void> setPendingDone(String id, {bool done = true});
  Future<List<Reminder>> getReminders();
  Stream<void> watch();
}
