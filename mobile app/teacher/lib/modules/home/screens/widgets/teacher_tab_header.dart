import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../school/bloc/school_bloc.dart';
import '../../bloc/notifications_bloc.dart';

/// [AppTabHeader] wired to the signed-in teacher and unread notifications. Used by all five tabs.
class TeacherTabHeader extends StatelessWidget {
  const TeacherTabHeader({super.key, required this.title, this.subtitle, this.eyebrow, this.icon});
  final String title;
  final String? subtitle, eyebrow;
  /// null shows the app logo
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final name = context.select<SchoolBloc, String>((b) => b.state.teacher?.name ?? 'Teacher');
    final unread = context.select<NotificationsBloc, int>((b) => b.state.unread);
    return AppTabHeader(
      title: title, subtitle: subtitle, eyebrow: eyebrow, icon: icon, userName: name, hasUnread: unread > 0,
      onBell: () => context.push(RoutePaths.notifications),
      onAvatar: () => context.push(RoutePaths.profile),
    );
  }
}


/// Bell (unread dot) + avatar shown on the right of pushed home-module headers (Figma detail frames).
class TeacherHeaderActions extends StatelessWidget {
  const TeacherHeaderActions({super.key, this.bell = true, this.avatar = true});
  final bool bell, avatar;
  @override
  Widget build(BuildContext context) {
    final name = context.select<SchoolBloc, String>((b) => b.state.teacher?.name ?? 'Teacher');
    final unread = context.select<NotificationsBloc, int>((b) => b.state.unread);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (bell)
        Semantics(
          button: true, label: unread > 0 ? 'Notifications, unread' : 'Notifications',
          child: InkResponse(
            onTap: () => context.push(RoutePaths.notifications),
            child: Container(
              width: 44.r, height: 44.r,
              decoration: BoxDecoration(color: C.panel, shape: BoxShape.circle, border: Border.all(color: C.panelBorder)),
              child: Stack(alignment: Alignment.center, children: [
                Icon(Icons.notifications_none_rounded, color: C.primary, size: 22.r),
                if (unread > 0)
                  Positioned(right: 10.r, top: 10.r, child: Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: C.danger, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)))),
              ]),
            ),
          ),
        ),
      if (bell && avatar) SizedBox(width: 8.w),
      if (avatar) Semantics(button: true, label: 'Profile', child: InkResponse(onTap: () => context.push(RoutePaths.profile), child: Avatar(name, size: 44, online: true))),
      SizedBox(width: 4.w),
    ]);
  }
}

const _tabRoutes = {RoutePaths.home, RoutePaths.timetable, RoutePaths.classes, RoutePaths.tasks, RoutePaths.more};

/// Opens a module route stored in data (notifications, pending tasks, reminders): tabs switch with `go`, others are pushed.
void openRoute(BuildContext context, String route) => _tabRoutes.contains(route) ? context.go(route) : context.push(route);
