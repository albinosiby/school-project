import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/notification_repository_interface.dart';
import 'notifications_events.dart';
import 'notifications_states.dart';

/// App-wide (drives the bell dot on every tab header and the notifications screens).
class NotificationsBloc extends Bloc<NotificationsEvent, NotificationsState> {
  NotificationsBloc(this._repo) : super(const NotificationsState()) {
    on<NotificationsLoadRequested>((e, emit) async => emit(NotificationsState(loaded: true, items: await _repo.getAll())));
    on<NotificationMarkedRead>((e, _) => _repo.markRead(e.id, read: e.read));
    on<NotificationsAllMarkedRead>((e, _) => _repo.markAllRead());
    on<NotificationDeleted>((e, _) => _repo.delete(e.id));
    on<NotificationsReadDeleted>((e, _) => _repo.deleteRead());
    _sub = _repo.watch().listen((_) => add(const NotificationsLoadRequested()));
  }

  final INotificationRepository _repo;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
