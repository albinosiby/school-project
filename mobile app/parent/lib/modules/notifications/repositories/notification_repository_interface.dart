import '../models/notification_models.dart';

abstract class INotificationRepository {
  /// The guardian's notifications, newest first (cache-first; writes push a fresh list).
  Stream<List<AppNotification>> watchNotifications();

  /// Unread count for the header bell dot.
  Stream<int> watchUnreadCount();

  Future<void> markRead(String id);
  Future<void> markAllRead();
  Future<void> delete(String id);

  /// Acknowledge a school notice (also marks it read).
  Future<void> acknowledge(String id);
}
