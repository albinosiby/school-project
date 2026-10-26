import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/notifications_bloc.dart';
import '../bloc/notifications_events.dart';
import '../models/notification_models.dart';
import 'widgets/notification_style.dart';

/// Notifications inbox (Figma 1153:1720 "6. Notifications"), route RoutePaths.notifications.
/// Uses the app-wide NotificationsBloc.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _tab = 'All';

  void _options(List<AppNotification> all) => showAppSheet<void>(
        context,
        title: 'Notification options',
        builder: (ctx) => Column(children: [
          ListTile(
            contentPadding: EdgeInsets.zero, minTileHeight: 52.h,
            leading: Icon(Icons.delete_sweep_outlined, size: 24.r), title: Text('Delete all read notifications', style: T.bodyStrong),
            onTap: () {
              Navigator.pop(ctx);
              final n = all.where((x) => x.read).length;
              context.read<NotificationsBloc>().add(const NotificationsReadDeleted());
              AppDialogs.showSnackBar(context, message: '$n read notifications deleted');
            },
          ),
          ListTile(
            contentPadding: EdgeInsets.zero, minTileHeight: 52.h,
            leading: Icon(Icons.tune_rounded, size: 24.r), title: Text('Notification settings', style: T.bodyStrong),
            onTap: () {
              Navigator.pop(ctx);
              context.push(RoutePaths.settings);
            },
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<NotificationsBloc>().state;
    final all = [...state.items]..sort((a, b) => notifTime(b).compareTo(notifTime(a)));
    final unread = state.unread;
    final shown = switch (_tab) {
      'Unread' => all.where((n) => !n.read).toList(),
      'Academic' || 'Duties' || 'Messages' => all.where((n) => n.category == _tab).toList(),
      _ => all,
    };
    final tabs = ['All (${all.length})', 'Unread ($unread)', 'Academic', 'Duties', 'Messages'];
    final tabValue = tabs.firstWhere((t) => t.startsWith(_tab), orElse: () => tabs.first);
    final now = DateTime.now();
    final children = <Widget>[];
    String? lastGroup;
    for (final n in shown) {
      final t = notifTime(n);
      final g = notifGroup(t, now);
      if (g != lastGroup) {
        lastGroup = g;
        children.add(Padding(
          padding: EdgeInsets.fromLTRB(4.w, 18.h, 4.w, 8.h),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(g, style: T.capsMuted), Text(notifDateLabel(t), style: T.small)]),
        ));
      }
      children.add(_NotifTile(n));
    }
    return DetailScaffold(
      title: 'Notifications',
      subtitle: unread > 0 ? '$unread new' : 'All caught up',
      actions: [
        IconButton(
          tooltip: 'Mark all as read',
          onPressed: unread == 0
              ? null
              : () {
                  context.read<NotificationsBloc>().add(const NotificationsAllMarkedRead());
                  AppDialogs.showSnackBar(context, message: 'All notifications marked as read');
                },
          icon: Icon(Icons.done_all_rounded, color: C.slate, size: 24.r),
        ),
        IconButton(tooltip: 'Notification options', onPressed: () => _options(all), icon: Icon(Icons.tune_rounded, color: C.slate, size: 24.r)),
      ],
      body: Column(children: [
        Padding(
          padding: EdgeInsets.fromLTRB(S.page, 12.h, 0, 0),
          child: FilterChips(items: tabs, value: tabValue, onChanged: (v) => setState(() => _tab = v.split(' ').first)),
        ),
        Expanded(
          child: shown.isEmpty
              ? Center(
                  child: AppEmptyState(_tab == 'Unread' ? 'No unread notifications' : 'No notifications', hint: 'You are all caught up.', icon: Icons.notifications_off_outlined),
                )
              : ListView(padding: EdgeInsets.fromLTRB(S.page, 0, S.page, 32.h), children: [
                  ...children,
                  Padding(
                    padding: EdgeInsets.all(20.r),
                    child: Center(child: Text('Older notifications are archived after 30 days', style: T.small.copyWith(color: C.muted), textAlign: TextAlign.center)),
                  ),
                ]),
        ),
      ]),
    );
  }
}

class _NotifTile extends StatelessWidget {
  const _NotifTile(this.n);
  final AppNotification n;
  @override
  Widget build(BuildContext context) {
    final (icon, tone) = notifStyle(n.type);
    final unread = !n.read;
    final chat = n.type == 'chat';
    final tc = toneColors(tone);
    final homework = n.type == 'homework';
    return Dismissible(
      key: ValueKey(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.only(right: 24.w), alignment: Alignment.centerRight,
        decoration: BoxDecoration(color: C.dangerSoft, borderRadius: BorderRadius.circular(R.xl)),
        child: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r),
      ),
      onDismissed: (_) {
        context.read<NotificationsBloc>().add(NotificationDeleted(n.id));
        AppDialogs.showSnackBar(context, message: 'Notification deleted');
      },
      child: Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          radius: R.xl, padding: EdgeInsets.all(14.r),
          onTap: () {
            context.read<NotificationsBloc>().add(NotificationMarkedRead(n.id));
            context.push(RoutePaths.notification(n.id));
          },
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            chat ? Avatar(n.title, size: 48, online: true) : IconTile(icon, tone: tone, size: 48),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                      decoration: BoxDecoration(color: tc.bg, borderRadius: BorderRadius.circular(6.r)),
                      child: Text(n.tag, style: T.small.copyWith(color: tc.fg, fontSize: 11.sp, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                  SizedBox(width: 8.w), Text(notifAgo(notifTime(n)), style: T.small),
                ]),
                SizedBox(height: 6.h),
                Text(n.title, style: T.h3.copyWith(fontWeight: unread ? FontWeight.w800 : FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 2.h),
                if (homework)
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(color: C.successSoft, borderRadius: BorderRadius.circular(6.r)),
                    child: Text(n.body, style: T.small.copyWith(color: C.successDark, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                  )
                else
                  Text(chat ? '“${n.body}”' : n.body, style: T.small.copyWith(fontStyle: chat ? FontStyle.italic : null), maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
            SizedBox(width: 6.w),
            Column(children: [
              if (unread)
                Semantics(label: 'Unread', child: Container(width: 8.r, height: 8.r, decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle)))
              else
                SizedBox(height: 8.r),
              SizedBox(height: 18.h),
              Icon(Icons.chevron_right_rounded, size: 18.r, color: C.muted),
            ]),
          ]),
        ),
      ),
    );
  }
}
