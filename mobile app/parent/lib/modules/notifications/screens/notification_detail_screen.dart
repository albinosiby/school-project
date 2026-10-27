import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/routes/routes.dart';
import '../../../constants/app_constants.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/notifications_bloc.dart';
import '../models/notification_models.dart';
import 'widgets/notification_bell.dart';
import 'widgets/notification_visuals.dart';

/// Figma "7.1 Notification Detail": marks the notification read on open; acknowledge (school notices)
/// and an action button that deep-links to the related screen.
class NotificationDetailScreen extends StatefulWidget {
  const NotificationDetailScreen({super.key, required this.id});
  final String id;

  @override
  State<NotificationDetailScreen> createState() => _NotificationDetailScreenState();
}

class _NotificationDetailScreenState extends State<NotificationDetailScreen> {
  late final NotificationsBloc _bloc = findNotificationsBloc(context) ?? getIt<NotificationsBloc>();
  String get id => widget.id;

  @override
  void initState() {
    super.initState();
    // Mark read on open (the listener covers a cold start where the list arrives later).
    if (_bloc.state.byId(id)?.read == false) _bloc.add(MarkNotificationRead(id));
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _bloc,
      child: BlocConsumer<NotificationsBloc, NotificationsState>(
        listenWhen: (a, b) => a.byId(id) == null && b.byId(id)?.read == false,
        listener: (context, s) => context.read<NotificationsBloc>().add(MarkNotificationRead(id)),
        builder: (context, state) {
          final n = state.byId(id);
          return DetailScaffold(
            title: 'Notification',
            fallbackRoute: RoutePaths.notifications,
            actions: [
              if (n != null)
                IconButton(
                  tooltip: 'Delete notification',
                  onPressed: () => _delete(context, n),
                  icon: Icon(Icons.delete_outline_rounded, color: C.slate, size: 22.r),
                ),
            ],
            bottom: n == null ? null : _actions(context, n),
            body: n != null
                ? _Body(n: n)
                : state.status == LoadStatus.loading
                ? const AppLoading(rows: 3)
                : const AppEmptyState(
                    'Notification not found',
                    hint: 'It may have been deleted.',
                    icon: Icons.notifications_off_outlined,
                  ),
          );
        },
      ),
    );
  }

  Widget? _actions(BuildContext context, AppNotification n) {
    final ack = n.needsAction;
    if (!ack && n.actionRoute == null) return null;
    return Row(
      children: [
        if (ack)
          Expanded(
            child: AppButton(
              'Acknowledge',
              icon: Icons.check_rounded,
              kind: n.actionRoute == null ? BtnKind.primary : BtnKind.outline,
              onPressed: () {
                context.read<NotificationsBloc>().add(AcknowledgeNotification(n.id));
                AppDialogs.showSnackBar(context, message: 'Notice acknowledged');
              },
            ),
          ),
        if (ack && n.actionRoute != null) SizedBox(width: 10.w),
        if (n.actionRoute != null)
          Expanded(
            child: AppButton(
              n.actionLabel ?? 'Open',
              icon: Icons.arrow_forward_rounded,
              onPressed: () => openNotificationRoute(context, n.actionRoute!),
            ),
          ),
      ],
    );
  }

  Future<void> _delete(BuildContext context, AppNotification n) async {
    final ok = await AppDialogs.showConfirmDialog(
      context,
      title: 'Delete notification?',
      message: '"${n.title}" will be removed from your notifications.',
      confirm: 'Delete',
      danger: true,
    );
    if (!ok || !context.mounted) return;
    context.read<NotificationsBloc>().add(DeleteNotification(n.id));
    AppDialogs.showSnackBar(context, message: 'Notification deleted');
    context.canPop() ? context.pop() : context.go(RoutePaths.notifications);
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.n});
  final AppNotification n;

  @override
  Widget build(BuildContext context) {
    final v = notificationVisual(n.category);
    return ListView(
      padding: EdgeInsets.fromLTRB(S.page + 2.w, 16.h, S.page + 2.w, 24.h),
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8.w,
          runSpacing: 6.h,
          children: [
            Pill(n.category.label, tone: v.tone, icon: v.icon),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.schedule_rounded, size: 16.r, color: C.slate),
                SizedBox(width: 4.w),
                Text(DateFormat('d MMM yyyy - hh:mm a').format(n.time), style: T.small),
              ],
            ),
          ],
        ),
        SizedBox(height: 14.h),
        Text(n.title, style: T.h1),
        SizedBox(height: 8.h),
        Wrap(
          spacing: 8.w,
          runSpacing: 6.h,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (n.childLabel != null) Pill(n.childLabel!, tone: Tone.neutral),
            Text(AppConstants.schoolName, style: T.small),
          ],
        ),
        SizedBox(height: 16.h),
        for (final para in n.body.split('\n\n'))
          Padding(
            padding: EdgeInsets.only(bottom: 12.h),
            child: Text(para, style: T.body.copyWith(color: C.ink, height: 1.6)),
          ),
        if (n.requiresAck && n.acknowledged)
          const Align(
            alignment: Alignment.centerLeft,
            child: Pill('Acknowledged', tone: Tone.success, icon: Icons.check_rounded),
          ),
        if (n.needsAction)
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(
              color: C.warningSoft,
              borderRadius: BorderRadius.circular(R.md),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, color: C.warningDark, size: 20.r),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text(
                    'The school has asked you to acknowledge this notice.',
                    style: T.small.copyWith(color: C.warningDark),
                  ),
                ),
              ],
            ),
          ),
        SizedBox(height: 24.h),
        Center(
          child: Text(
            [
              if (n.reference != null) 'Ref: ${n.reference}',
              if (n.from != null) n.from!,
            ].join(' - '),
            style: T.small.copyWith(color: C.muted, fontSize: 11.sp),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}
