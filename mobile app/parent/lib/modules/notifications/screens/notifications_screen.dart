import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/notifications_bloc.dart';
import '../models/notification_models.dart';
import 'widgets/notification_bell.dart';
import 'widgets/notification_visuals.dart';

/// Figma "7. Notifications": filter chips with counts, date groups, mark all read, swipe / X to delete,
/// acknowledge for school notices, and quick actions that deep-link into the app.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) => BlocProvider.value(
    value: findNotificationsBloc(context) ?? getIt<NotificationsBloc>(),
    child: DetailScaffold(
      title: 'Notifications',
      fallbackRoute: RoutePaths.home,
      body: BlocBuilder<NotificationsBloc, NotificationsState>(
        builder: (context, state) {
          if (state.status == LoadStatus.loading && state.items.isEmpty) {
            return const AppLoading(rows: 5);
          }
          if (state.status == LoadStatus.error) {
            return AppErrorWidget(
              message: state.error ?? 'Could not load notifications.',
              onRetry: () => context.read<NotificationsBloc>().add(const LoadNotifications()),
            );
          }
          return _NotificationList(state: state);
        },
      ),
    ),
  );
}

class _NotificationList extends StatelessWidget {
  const _NotificationList({required this.state});
  final NotificationsState state;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<NotificationsBloc>();
    final now = DateTime.now();
    final groups = <DateTime, List<AppNotification>>{};
    for (final n in state.visible) {
      groups.putIfAbsent(dateOnly(n.time), () => []).add(n);
    }
    return RefreshIndicator(
      onRefresh: () async => bloc.add(const LoadNotifications()),
      child: ListView(
        padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 24.h),
        children: [
          Row(
            children: [
              Text('NOTIFICATION CENTER', style: T.capsMuted),
              if (state.unread > 0) ...[
                SizedBox(width: 6.w),
                Container(
                  width: 6.r,
                  height: 6.r,
                  decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                ),
              ],
              const Spacer(),
              TextButton.icon(
                key: const ValueKey('mark-all-read'),
                onPressed: state.unread == 0
                    ? null
                    : () {
                        bloc.add(const MarkAllNotificationsRead());
                        AppDialogs.showSnackBar(context, message: 'All notifications marked as read');
                      },
                icon: Icon(Icons.done_all_rounded, size: 18.r),
                label: Text(
                  'Mark all as read',
                  style: T.smallStrong.copyWith(color: state.unread == 0 ? C.muted : C.primary),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: C.primary,
                  minimumSize: Size(44.w, 44.h),
                ),
              ),
            ],
          ),
          SizedBox(height: 4.h),
          _FilterBar(state: state),
          SizedBox(height: 8.h),
          if (groups.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 48.h),
              child: AppEmptyState(
                state.filter == NotificationFilter.unread ? 'You are all caught up' : 'No notifications',
                hint: state.filter == NotificationFilter.all
                    ? 'School updates, bus alerts and fee reminders will appear here.'
                    : 'Nothing in ${state.filter.label} right now.',
                icon: Icons.notifications_off_outlined,
              ),
            )
          else
            for (final e in groups.entries) ...[
              _GroupHeader(day: e.key, items: e.value, now: now),
              for (final n in e.value) _NotificationCard(n: n, now: now),
            ],
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.state});
  final NotificationsState state;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        for (final f in NotificationFilter.values)
          Padding(
            padding: EdgeInsets.only(right: 8.w),
            child: _FilterChip(
              filter: f,
              selected: state.filter == f,
              count: switch (f) {
                NotificationFilter.all => state.items.length,
                NotificationFilter.unread => state.unread,
                _ => null,
              },
            ),
          ),
      ],
    ),
  );
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.filter, required this.selected, this.count});
  final NotificationFilter filter;
  final bool selected;
  final int? count;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: count == null ? filter.label : '${filter.label}, $count',
    excludeSemantics: true,
    child: InkWell(
      key: ValueKey('notification-filter-${filter.name}'),
      borderRadius: BorderRadius.circular(R.pill),
      onTap: () => context.read<NotificationsBloc>().add(ChangeNotificationFilter(filter)),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        constraints: BoxConstraints(minHeight: 40.h),
        padding: EdgeInsets.symmetric(horizontal: 14.w),
        decoration: BoxDecoration(
          color: selected ? C.primary : C.surfaceLow,
          borderRadius: BorderRadius.circular(R.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              filter.label,
              style: T.bodyStrong.copyWith(color: selected ? Colors.white : C.ink),
            ),
            if (count != null) ...[
              SizedBox(width: 6.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: .2)
                      : (filter == NotificationFilter.unread ? C.primary : C.border),
                  borderRadius: BorderRadius.circular(R.pill),
                ),
                child: Text(
                  '$count',
                  style: T.smallStrong.copyWith(
                    color: selected || filter == NotificationFilter.unread ? Colors.white : C.ink,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.day, required this.items, required this.now});
  final DateTime day;
  final List<AppNotification> items;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final unread = items.where((n) => !n.read).length;
    return Padding(
      padding: EdgeInsets.fromLTRB(4.w, 14.h, 4.w, 8.h),
      child: Row(
        children: [
          Text(fmtDay(day, now: now), style: T.h3),
          if (unread > 0) ...[
            SizedBox(width: 6.w),
            Container(
              width: 6.r,
              height: 6.r,
              decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
            ),
          ],
          const Spacer(),
          Text(
            unread > 0
                ? '$unread new ${unread == 1 ? 'update' : 'updates'}'
                : '${items.length} ${items.length == 1 ? 'update' : 'updates'}',
            style: T.small,
          ),
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.n, required this.now});
  final AppNotification n;
  final DateTime now;

  void _delete(BuildContext context) {
    context.read<NotificationsBloc>().add(DeleteNotification(n.id));
    AppDialogs.showSnackBar(context, message: 'Notification deleted');
  }

  @override
  Widget build(BuildContext context) {
    final v = notificationVisual(n.category);
    final tone = toneColors(v.tone);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Dismissible(
        key: ValueKey('notification-${n.id}'),
        direction: DismissDirection.endToStart,
        onDismissed: (_) => _delete(context),
        background: Container(
          alignment: Alignment.centerRight,
          padding: EdgeInsets.only(right: 20.w),
          decoration: BoxDecoration(
            color: C.dangerSoft,
            borderRadius: BorderRadius.circular(R.lg),
          ),
          child: Icon(Icons.delete_outline_rounded, color: C.danger, size: 24.r),
        ),
        child: Material(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.lg),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => context.push(RoutePaths.notification(n.id)),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: n.read ? C.border : C.primary.withValues(alpha: .25)),
                borderRadius: BorderRadius.circular(R.lg),
              ),
              foregroundDecoration: n.read
                  ? null
                  : BoxDecoration(
                      border: Border(left: BorderSide(color: C.primary, width: 3.w)),
                    ),
              padding: EdgeInsets.fromLTRB(12.w, 12.h, 4.w, 12.h),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconTile(v.icon, tone: v.tone, size: 36),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                n.category.label.toUpperCase(),
                                style: T.caps.copyWith(color: tone.fg, fontSize: 10.5.sp),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (!n.read) ...[
                              Container(
                                width: 6.r,
                                height: 6.r,
                                decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle),
                              ),
                              SizedBox(width: 4.w),
                            ],
                            Text(notificationTimeLabel(n.time, now: now), style: T.small),
                          ],
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          n.title,
                          style: T.bodyStrong.copyWith(
                            fontSize: 15.sp,
                            fontWeight: n.read ? FontWeight.w600 : FontWeight.w700,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (n.summary != null)
                          Text(n.summary!, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                        if (n.needsAction || (n.actionRoute != null && !n.read)) ...[
                          SizedBox(height: 8.h),
                          Wrap(
                            spacing: 8.w,
                            runSpacing: 6.h,
                            children: [
                              if (n.needsAction)
                                AppButton(
                                  'Acknowledge',
                                  small: true,
                                  expand: false,
                                  icon: Icons.check_rounded,
                                  onPressed: () {
                                    context.read<NotificationsBloc>().add(AcknowledgeNotification(n.id));
                                    AppDialogs.showSnackBar(context, message: 'Notice acknowledged');
                                  },
                                ),
                              if (n.actionRoute != null && !n.read)
                                AppButton(
                                  n.actionLabel ?? 'Open',
                                  small: true,
                                  expand: false,
                                  icon: Icons.arrow_forward_rounded,
                                  onPressed: () {
                                    context.read<NotificationsBloc>().add(MarkNotificationRead(n.id));
                                    openNotificationRoute(context, n.actionRoute!);
                                  },
                                ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Delete notification',
                    onPressed: () => _delete(context),
                    icon: Icon(Icons.close_rounded, size: 18.r, color: C.slate),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
