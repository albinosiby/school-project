import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../di/injection.dart';
import '../../bloc/notifications_bloc.dart';

/// The provided [NotificationsBloc] (di/global_blocs.dart) or else the GetIt singleton; null when neither exists.
NotificationsBloc? findNotificationsBloc(BuildContext context) {
  try {
    return BlocProvider.of<NotificationsBloc>(context);
  } catch (_) {
    return getIt.isRegistered<NotificationsBloc>() ? getIt<NotificationsBloc>() : null;
  }
}

/// Rebuilds with the unread notification count. Uses the provided [NotificationsBloc] when there is one
/// (di/global_blocs.dart), otherwise the GetIt singleton; with neither it reports 0, so any header can use it.
class UnreadNotificationsBuilder extends StatelessWidget {
  const UnreadNotificationsBuilder({super.key, required this.builder});
  final Widget Function(BuildContext context, int unread) builder;

  @override
  Widget build(BuildContext context) {
    final bloc = findNotificationsBloc(context);
    if (bloc == null) return builder(context, 0);
    return BlocSelector<NotificationsBloc, NotificationsState, int>(
      bloc: bloc,
      selector: (s) => s.unread,
      builder: builder,
    );
  }
}

/// Bell button with the unread dot for detail headers (Figma: bell + avatar at the top right).
class NotificationBellButton extends StatelessWidget {
  const NotificationBellButton({super.key});

  @override
  Widget build(BuildContext context) => UnreadNotificationsBuilder(
    builder: (context, unread) => IconButton(
      key: const ValueKey('notification-bell'),
      tooltip: unread > 0 ? 'Notifications, $unread unread' : 'Notifications',
      onPressed: () => context.push(RoutePaths.notifications),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(Icons.notifications_none_rounded, color: C.ink, size: 24.r),
          if (unread > 0)
            Positioned(
              right: 1.r,
              top: 1.r,
              child: Container(
                width: 9.r,
                height: 9.r,
                decoration: BoxDecoration(
                  color: C.notificationDot,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
