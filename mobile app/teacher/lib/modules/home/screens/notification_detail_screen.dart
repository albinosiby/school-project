import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../bloc/notifications_bloc.dart';
import '../bloc/notifications_events.dart';
import 'widgets/notification_style.dart';
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
    final ok = await AppDialogs.showConfirmDialog(context, title: 'Delete notification?', message: 'This notification will be removed.', confirm: 'Delete', danger: true);
    if (!ok || !mounted) return;
    setState(() => _deleting = true);
    context.read<NotificationsBloc>().add(NotificationDeleted(widget.id));
    AppDialogs.showSnackBar(context, message: 'Notification deleted');
    context.canPop() ? context.pop() : context.go(RoutePaths.notifications);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<NotificationsBloc>().state;
    final n = state.byId(widget.id);
    if (n == null) {
      return DetailScaffold(
        title: 'Notification', fallbackRoute: RoutePaths.notifications,
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
    final leave = n.type == 'leave';
    final route = n.route;
    final actionLabel = switch (n.type) {
      'leave' => 'Review leave requests',
      'homework' => 'Open homework',
      'exam' => 'View exam duty',
      'chat' => 'Open conversation',
      'circular' => 'Read circular',
      'attendance' => 'View attendance history',
      _ => 'Open',
    };
    return DetailScaffold(
      title: 'Notification',
      fallbackRoute: RoutePaths.notifications,
      actions: [
        IconButton(tooltip: 'Delete notification', icon: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r), onPressed: _delete),
        const TeacherHeaderActions(bell: false),
      ],
      bottom: route == null || route.isEmpty ? null : AppButton(actionLabel, onPressed: () => openRoute(context, route)),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 18.h, S.page, 32.h), children: [
        Row(children: [
          Flexible(child: Pill(leave ? 'STUDENT LEAVE' : n.tag.toUpperCase(), tone: leave ? Tone.brand : tone, icon: icon)),
          SizedBox(width: 8.w),
          const Spacer(),
          Icon(Icons.schedule_rounded, size: 14.r, color: C.slate), SizedBox(width: 4.w),
          Text(notifAgo(notifTime(n)), style: T.small),
        ]),
        SizedBox(height: 16.h),
        Text(leave ? 'Leave Application Submitted' : n.title, style: T.title),
        SizedBox(height: 6.h),
        Text(leave ? 'Review request & update register attendance' : '${n.tag} • ${notifDateLabel(notifTime(n))}', style: T.body),
        SizedBox(height: 18.h),
        if (leave) ..._leaveBody(context) else
          AppCard(radius: R.xl, color: C.surface, child: SizedBox(width: double.infinity, child: Text(n.body, style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500, color: C.ink)))),
      ]),
    );
  }

  List<Widget> _leaveBody(BuildContext context) => [
        AppCard(
          color: C.surface, radius: R.xl,
          child: Column(children: [
            Row(children: [
              const Avatar('Ananya Reddy', size: 52, online: true), SizedBox(width: 12.w),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text('Ananya Reddy', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 4.w), Icon(Icons.verified_rounded, size: 16.r, color: C.primary),
                  ]),
                  Text('Class 10-B • Roll #02', style: T.small),
                ]),
              ),
              const Flexible(child: Pill('2 Days Medical', tone: Tone.danger, dot: true)),
            ]),
            Divider(height: 24.h),
            Row(children: [
              Icon(Icons.calendar_today_outlined, size: 15.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(child: Text('28 – 29 Oct 2024', style: T.bodyStrong)),
              Text('Secondary Wing', style: T.small),
            ]),
          ]),
        ),
        const SectionHeader('Reason & guardian note', caps: true),
        Container(
          padding: EdgeInsets.fromLTRB(14.w, 6.h, 6.w, 6.h),
          decoration: const BoxDecoration(border: Border(left: BorderSide(color: C.primary, width: 3))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('"Ananya has viral fever since last night. Physician at Dr. Batra Clinic advised strict bed rest for two days."',
                style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500, color: C.ink)),
            SizedBox(height: 8.h),
            Text.rich(TextSpan(children: [TextSpan(text: 'Mrs. Rao ', style: T.smallStrong), TextSpan(text: '• Mother', style: T.small)])),
          ]),
        ),
        SizedBox(height: 14.h),
        AppCard(
          radius: R.lg, padding: EdgeInsets.all(12.r), onTap: () => AppDialogs.showSnackBar(context, message: 'Opening Medical_Certificate_Oct24.pdf (simulated)'),
          child: Row(children: [
            const IconTile(Icons.description_outlined, size: 40), SizedBox(width: 12.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Medical_Certificate_Oct24.pdf', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis), Text('420 KB', style: T.small),
              ]),
            ),
            Icon(Icons.visibility_outlined, size: 18.r, color: C.primary), SizedBox(width: 4.w),
            Text('View', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
          ]),
        ),
      ];
}
