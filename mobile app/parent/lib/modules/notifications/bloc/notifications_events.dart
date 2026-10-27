import 'package:equatable/equatable.dart';
import '../models/notification_models.dart';

sealed class NotificationsEvent extends Equatable {
  const NotificationsEvent();
  @override
  List<Object?> get props => [];
}

class LoadNotifications extends NotificationsEvent {
  const LoadNotifications();
}

class ChangeNotificationFilter extends NotificationsEvent {
  const ChangeNotificationFilter(this.filter);
  final NotificationFilter filter;
  @override
  List<Object?> get props => [filter];
}

class MarkNotificationRead extends NotificationsEvent {
  const MarkNotificationRead(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class MarkAllNotificationsRead extends NotificationsEvent {
  const MarkAllNotificationsRead();
}

class DeleteNotification extends NotificationsEvent {
  const DeleteNotification(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class AcknowledgeNotification extends NotificationsEvent {
  const AcknowledgeNotification(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
