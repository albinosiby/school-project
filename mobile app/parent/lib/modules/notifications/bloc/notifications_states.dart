import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/notification_models.dart';

class NotificationsState extends Equatable {
  const NotificationsState({
    this.status = LoadStatus.loading,
    this.items = const [],
    this.filter = NotificationFilter.all,
    this.error,
  });
  final LoadStatus status;

  /// Every notification, newest first.
  final List<AppNotification> items;
  final NotificationFilter filter;
  final String? error;

  int get unread => items.where((n) => !n.read).length;
  int countFor(NotificationFilter f) => items.where(f.matches).length;

  /// Items of the selected filter chip.
  List<AppNotification> get visible => items.where(filter.matches).toList();

  AppNotification? byId(String id) =>
      items.where((n) => n.id == id).firstOrNull;

  NotificationsState copyWith({
    LoadStatus? status,
    List<AppNotification>? items,
    NotificationFilter? filter,
    String? error,
  }) => NotificationsState(
    status: status ?? this.status,
    items: items ?? this.items,
    filter: filter ?? this.filter,
    error: error,
  );

  @override
  List<Object?> get props => [status, items, filter, error];
}
