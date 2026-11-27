import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/notifications_bloc.dart';
import '../bloc/notifications_events.dart';
import 'widgets/notification_style.dart';
import '../../../utils/services/link_launcher.dart';
import 'widgets/teacher_tab_header.dart';

/// One notification (Figma 1153:2361 "7.1.1 View Notification"), route RoutePaths.notificationDetail.
class NotificationDetailScreen extends StatefulWidget {
  const NotificationDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<NotificationDetailScreen> createState() => _NotificationDetailScreenState();
}

class _NotificationDetailScreenState extends State<NotificationDetailScreen> {
  bool _deleting = false, _markedRead = false;

  Future<void> _delete() async {
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Delete notification?',
      message: 'This notification will be removed.',
      confirm: 'Delete',
      danger: true,
    );
    if (!ok || !mounted) return;
    setState(() => _deleting = true);
    final bloc = context.read<NotificationsBloc>();
    final n = bloc.state.byId(widget.id);
    bloc.add(NotificationDeleted(widget.id));
    AppDialogs.showSnackBar(
      context,
      message: 'Notification deleted',
      action: n == null ? null : 'Undo',
      onAction: n == null ? null : () => bloc.add(NotificationRestored(n)),
    );
    context.canPop() ? context.pop() : context.go(RoutePaths.notifications);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<NotificationsBloc>().state;
    final n = state.byId(widget.id);
    if (n == null) {
      return DetailScaffold(
        title: 'Notification',
        fallbackRoute: RoutePaths.notifications,
        body: Center(
          child: !state.loaded || _deleting
              ? const SizedBox.shrink()
              : const AppEmptyState('Notification not found', icon: Icons.notifications_off_outlined),
        ),
      );
    }
    if (!n.read && !_markedRead) {
      _markedRead = true; // opening a notification marks it read (once; the bloc may still hold the old state)
      context.read<NotificationsBloc>().add(NotificationMarkedRead(widget.id));
    }
    final (icon, tone) = notifStyle(n.type);
    final tc = toneColors(tone);
    final route = n.route;
    final t = notifTime(n);
    final links = {for (final m in _url.allMatches(n.body)) m.group(0)!}.toList();
    final actionLabel = switch (n.type) {
      'leave' => 'Review leave requests',
      'homework' => 'Open assignment',
      'exam' => 'View exam duty',
      'chat' || 'message' => 'Open conversation',
      'circular' || 'notice' => 'Read circular',
      'attendance' => 'View attendance history',
      'meeting' || 'ptm' => 'Open meetings',
      'live' => 'Open live classes',
      'substitution' => 'Open timetable',
      'assignment' => 'Open my classes',
      'lesson' => 'Open lesson plan',
      _ => 'Open',
    };
    return DetailScaffold(
      title: 'Notification',
      fallbackRoute: RoutePaths.notifications,
      actions: [
        IconButton(
          tooltip: 'Delete notification',
          icon: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r),
          onPressed: _delete,
        ),
      ],
      bottom: route == null || route.isEmpty
          ? null
          : AppButton(actionLabel, icon: Icons.arrow_forward_rounded, onPressed: () => openRoute(context, route)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(S.page, 16.h, S.page, 32.h),
        children: [
          // ---- what it is
          Container(
            padding: EdgeInsets.all(16.r),
            decoration: BoxDecoration(
              color: tc.bg,
              borderRadius: BorderRadius.circular(R.xl),
              border: Border.all(color: tc.fg.withValues(alpha: .15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48.r,
                      height: 48.r,
                      decoration: const BoxDecoration(color: C.bg, shape: BoxShape.circle),
                      child: Icon(icon, size: 24.r, color: tc.fg),
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (n.tag.isEmpty ? n.category : n.tag).toUpperCase(),
                            style: T.caps.copyWith(color: tc.fg, fontSize: 11.sp),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            '${notifDateLabel(t)} • ${_clock(t)}',
                            style: T.small.copyWith(color: C.ink.withValues(alpha: .7)),
                          ),
                        ],
                      ),
                    ),
                    Text(notifAgo(t), style: T.small),
                  ],
                ),
                SizedBox(height: 14.h),
                Text(n.title, style: T.h2.copyWith(height: 1.3)),
              ],
            ),
          ),
          SizedBox(height: 14.h),

          // ---- the message
          if (n.body.trim().isNotEmpty)
            AppCard(
              radius: R.xl,
              padding: EdgeInsets.all(16.r),
              child: SizedBox(
                width: double.infinity,
                child: SelectableText(
                  n.body.trim(),
                  style: T.body.copyWith(color: C.ink, fontSize: 14.5.sp, height: 1.6),
                ),
              ),
            ),

          // ---- links in the message (a Meet link, a form…)
          for (final l in links) ...[
            SizedBox(height: 10.h),
            AppCard(
              radius: R.lg,
              padding: EdgeInsets.all(12.r),
              onTap: () => launchExternal(Uri.parse(l)),
              child: Row(
                children: [
                  IconTile(l.contains('meet.google.com') ? Icons.videocam_outlined : Icons.link_rounded, size: 38),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.contains('meet.google.com') ? 'Join Google Meet' : 'Open link', style: T.bodyStrong),
                        Text(
                          l.replaceFirst(RegExp(r'^https?://'), ''),
                          style: T.small,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.open_in_new_rounded, size: 18.r, color: C.primary),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static final _url = RegExp(r'https?://[^\s)]+');
  static String _clock(DateTime t) =>
      '${((t.hour + 11) % 12) + 1}:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
}
