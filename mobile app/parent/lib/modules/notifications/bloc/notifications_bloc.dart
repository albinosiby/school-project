import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../repositories/notification_repository_interface.dart';
import 'notifications_events.dart';
import 'notifications_states.dart';

export 'notifications_events.dart';
export 'notifications_states.dart';

/// Global (lazy singleton): the notification centre and the unread count of the header bell.
/// Starts loading on creation; writes go through the repository, whose stream pushes the new list.
class NotificationsBloc extends Bloc<NotificationsEvent, NotificationsState> {
  NotificationsBloc(this._repo) : super(const NotificationsState()) {
    on<LoadNotifications>(
      (event, emit) => emit.forEach(
        _repo.watchNotifications(),
        onData: (items) =>
            state.copyWith(status: LoadStatus.loaded, items: items),
        onError: (e, _) => state.items.isNotEmpty
            ? state
            : state.copyWith(status: LoadStatus.error, error: errorMessage(e)),
      ),
      transformer: restartable(),
    );
    on<ChangeNotificationFilter>(
      (event, emit) => emit(state.copyWith(filter: event.filter)),
    );
    on<MarkNotificationRead>((event, emit) async {
      if (state.byId(event.id)?.read ?? true) return;
      await _repo.markRead(event.id);
    });
    on<MarkAllNotificationsRead>((event, emit) => _repo.markAllRead());
    on<DeleteNotification>((event, emit) {
      // Remove at once so a swiped Dismissible leaves the tree; the repository confirms.
      emit(
        state.copyWith(
          items: [
            for (final n in state.items)
              if (n.id != event.id) n,
          ],
        ),
      );
      return _repo.delete(event.id);
    });
    on<AcknowledgeNotification>((event, emit) => _repo.acknowledge(event.id));
    add(const LoadNotifications());
  }

  final INotificationRepository _repo;
}
