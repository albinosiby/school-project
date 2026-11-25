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

  /// What was unread when the page opened: shown as New for this visit, while everything is marked read at once.
  Set<String>? _fresh;

  void _markSeen(List<AppNotification> items) {
    if (_fresh != null) return;
    _fresh = {
      for (final n in items)
        if (!n.read) n.id,
    };
    if (_fresh!.isNotEmpty) context.read<NotificationsBloc>().add(const NotificationsAllMarkedRead());
  }

  @override
  void initState() {
    super.initState();
    final st = context.read<NotificationsBloc>().state;
    if (st.loaded) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _markSeen(st.items) : null);
  }

  void _options(List<AppNotification> all) => showAppSheet<void>(
    context,
    title: 'Notification options',
    builder: (ctx) => Column(
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          minTileHeight: 52.h,
          leading: Icon(Icons.delete_sweep_outlined, size: 24.r),
          title: Text('Clear all notifications', style: T.bodyStrong),
          onTap: () {
            Navigator.pop(ctx);
            context.read<NotificationsBloc>().add(const NotificationsReadDeleted());
            AppDialogs.showSnackBar(context, message: '${all.length} notifications cleared');
          },
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          minTileHeight: 52.h,
          leading: Icon(Icons.tune_rounded, size: 24.r),
          title: Text('Notification settings', style: T.bodyStrong),
          onTap: () {
            Navigator.pop(ctx);
            context.push(RoutePaths.settings);
          },
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<NotificationsBloc>().state;
    if (state.loaded && _fresh == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _markSeen(state.items) : null);
    }
    final fresh =
        _fresh ??
        {
          for (final n in state.items)
            if (!n.read) n.id,
        };
    final all = [...state.items]..sort((a, b) => notifTime(b).compareTo(notifTime(a)));
    final cats = [
      for (final c in const ['Academic', 'Duties', 'Messages'])
        if (all.any((n) => n.category == c)) c,
    ];
    final shown = switch (_tab) {
      'New' => all.where((n) => fresh.contains(n.id)).toList(),
      'All' => all,
      _ => all.where((n) => n.category == _tab).toList(),
    };
    final now = DateTime.now();
    // New first (this visit), then by day
    final groups = <String, List<AppNotification>>{};
    for (final n in shown) {
      final g = fresh.contains(n.id) && _tab != 'New' ? 'New' : _groupTitle(notifGroup(notifTime(n), now));
      (groups[g] ??= []).add(n);
    }
    return DetailScaffold(
      title: 'Notifications',
      subtitle: fresh.isNotEmpty ? '${fresh.length} new' : 'All caught up',
      actions: [
        IconButton(
          tooltip: 'Notification options',
          onPressed: () => _options(all),
          icon: Icon(Icons.more_vert_rounded, color: C.slate, size: 24.r),
        ),
      ],
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.fromLTRB(S.page, 12.h, S.page, 4.h),
            child: Row(
              children: [
                _Chip(label: 'All', count: all.length, on: _tab == 'All', onTap: () => setState(() => _tab = 'All')),
                if (fresh.isNotEmpty)
                  _Chip(
                    label: 'New',
                    count: fresh.length,
                    on: _tab == 'New',
                    onTap: () => setState(() => _tab = 'New'),
                  ),
                for (final c in cats) _Chip(label: c, on: _tab == c, onTap: () => setState(() => _tab = c)),
              ],
            ),
          ),
          Expanded(
            child: shown.isEmpty
                ? Center(
                    child: AppEmptyState(
                      'No notifications',
                      hint: 'Circulars, meetings, duties and messages show up here.',
                      icon: Icons.notifications_off_outlined,
                    ),
                  )
                : ListView(
                    padding: EdgeInsets.fromLTRB(S.page, 4.h, S.page, 32.h),
                    children: [
                      for (final e in groups.entries) ...[
                        Padding(
                          padding: EdgeInsets.fromLTRB(4.w, 14.h, 4.w, 8.h),
                          child: Text(
                            e.key.toUpperCase(),
                            style: T.capsMuted.copyWith(fontSize: 11.sp, letterSpacing: .6),
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: C.bg,
                            borderRadius: BorderRadius.circular(R.lg),
                            border: Border.all(color: C.border),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            children: [
                              for (var i = 0; i < e.value.length; i++) ...[
                                if (i > 0) Divider(height: 1, indent: 64.w, color: C.border),
                                _NotifTile(e.value[i], fresh: fresh.contains(e.value[i].id)),
                              ],
                            ],
                          ),
                        ),
                      ],
                      Padding(
                        padding: EdgeInsets.all(20.r),
                        child: Center(
                          child: Text(
                            'Swipe left to delete • older ones are archived after 30 days',
                            style: T.small.copyWith(color: C.muted),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  static String _groupTitle(String g) => switch (g) {
    'TODAY' => 'Today',
    'YESTERDAY' => 'Yesterday',
    'EARLIER THIS WEEK' => 'Earlier this week',
    _ => 'Older',
  };
}

/// Small filter pill with an optional count.
class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.on, required this.onTap, this.count});
  final String label;
  final bool on;
  final int? count;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(right: 6.w),
    child: Semantics(
      button: true,
      selected: on,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.pill),
        onTap: onTap,
        child: Container(
          height: 34.h,
          padding: EdgeInsets.symmetric(horizontal: 12.w),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? C.primary : C.bg,
            borderRadius: BorderRadius.circular(R.pill),
            border: Border.all(color: on ? C.primary : C.border),
          ),
          child: Text(
            count == null ? label : '$label  $count',
            style: T.smallStrong.copyWith(fontSize: 12.5.sp, color: on ? Colors.white : C.ink),
          ),
        ),
      ),
    ),
  );
}

/// One notification row: type icon, title, two lines of text, tag and time. Swipe left to delete.
class _NotifTile extends StatelessWidget {
  const _NotifTile(this.n, {required this.fresh});
  final AppNotification n;
  final bool fresh;
  @override
  Widget build(BuildContext context) {
    final (icon, tone) = notifStyle(n.type);
    final tc = toneColors(tone);
    final chat = n.type == 'chat' || n.type == 'message';
    return Dismissible(
      key: ValueKey(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        padding: EdgeInsets.only(right: 24.w),
        alignment: Alignment.centerRight,
        color: C.dangerSoft,
        child: Icon(Icons.delete_outline_rounded, color: C.danger, size: 22.r),
      ),
      onDismissed: (_) {
        context.read<NotificationsBloc>().add(NotificationDeleted(n.id));
        AppDialogs.showSnackBar(context, message: 'Notification deleted');
      },
      child: Material(
        color: fresh ? C.primarySoft.withValues(alpha: .45) : C.bg,
        child: InkWell(
          onTap: () {
            context.read<NotificationsBloc>().add(NotificationMarkedRead(n.id));
            context.push(RoutePaths.notification(n.id));
          },
          child: Padding(
            padding: EdgeInsets.fromLTRB(12.w, 12.h, 12.w, 12.h),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                chat
                    ? Avatar(n.title, size: 40)
                    : Container(
                        width: 40.r,
                        height: 40.r,
                        decoration: BoxDecoration(color: tc.bg, shape: BoxShape.circle),
                        child: Icon(icon, size: 20.r, color: tc.fg),
                      ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              n.title,
                              style: T.bodyStrong.copyWith(
                                fontSize: 14.sp,
                                fontWeight: fresh ? FontWeight.w800 : FontWeight.w600,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Text(notifAgo(notifTime(n)), style: T.small.copyWith(fontSize: 11.sp)),
                        ],
                      ),
                      if (n.body.isNotEmpty) ...[
                        SizedBox(height: 2.h),
                        Text(
                          n.body.replaceAll(RegExp(r'\s+'), ' '),
                          style: T.small.copyWith(fontSize: 12.5.sp, height: 1.35, color: C.ink.withValues(alpha: .7)),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (n.tag.isNotEmpty) ...[
                        SizedBox(height: 6.h),
                        Text(
                          n.tag,
                          style: T.small.copyWith(fontSize: 11.sp, color: tc.fg, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
