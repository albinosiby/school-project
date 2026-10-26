import '../models/notification_models.dart';

abstract class INotificationRepository {
  Future<List<AppNotification>> getAll();
  Future<void> markRead(String id, {bool read = true});
  Future<void> markAllRead();
  Future<void> delete(String id);
  /// Removes every read notification; returns how many were removed.
  Future<int> deleteRead();
  /// Other modules post notifications through this (e.g. "Setup complete").
  Future<void> add(AppNotification n);
  Stream<void> watch();
}
