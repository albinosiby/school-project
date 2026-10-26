import 'package:equatable/equatable.dart';

sealed class NotificationsEvent extends Equatable {
  const NotificationsEvent();
  @override
  List<Object?> get props => [];
}

class NotificationsLoadRequested extends NotificationsEvent {
  const NotificationsLoadRequested();
}

class NotificationMarkedRead extends NotificationsEvent {
  const NotificationMarkedRead(this.id, {this.read = true});
  final String id;
  final bool read;
  @override
  List<Object?> get props => [id, read];
}

class NotificationsAllMarkedRead extends NotificationsEvent {
  const NotificationsAllMarkedRead();
}

class NotificationDeleted extends NotificationsEvent {
  const NotificationDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Deletes every read notification.
class NotificationsReadDeleted extends NotificationsEvent {
  const NotificationsReadDeleted();
}
