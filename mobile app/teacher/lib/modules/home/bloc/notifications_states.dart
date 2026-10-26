import 'package:equatable/equatable.dart';
import '../models/notification_models.dart';

class NotificationsState extends Equatable {
  const NotificationsState({this.loaded = false, this.items = const []});
  final bool loaded;
  final List<AppNotification> items;

  int get unread => items.where((n) => !n.read).length;
  AppNotification? byId(String id) => items.where((n) => n.id == id).firstOrNull;

  @override
  List<Object?> get props => [loaded, items];
}
