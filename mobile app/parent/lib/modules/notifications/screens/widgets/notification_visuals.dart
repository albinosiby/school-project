import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../../../utils/helpers/date_helper.dart';
import '../../models/notification_models.dart';

({IconData icon, Tone tone}) notificationVisual(NotificationCategory c) => switch (c) {
  NotificationCategory.transit => (icon: Icons.directions_bus_outlined, tone: Tone.brand),
  NotificationCategory.academic => (icon: Icons.assignment_outlined, tone: Tone.purple),
  NotificationCategory.fees => (icon: Icons.account_balance_wallet_outlined, tone: Tone.success),
  NotificationCategory.emergency => (icon: Icons.warning_amber_rounded, tone: Tone.danger),
  NotificationCategory.merit => (icon: Icons.workspace_premium_outlined, tone: Tone.warning),
  NotificationCategory.notice => (icon: Icons.campaign_outlined, tone: Tone.neutral),
};

/// "12m ago", "1h ago" today; "Yesterday, 4:30 PM"; "12 Oct, 9:00 AM".
String notificationTimeLabel(DateTime t, {DateTime? now}) {
  final n = now ?? DateTime.now();
  if (sameDay(t, n)) {
    final d = n.difference(t);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    return '${d.inHours}h ago';
  }
  if (sameDay(t, plusDays(-1, from: n))) return 'Yesterday, ${fmtClock(t)}';
  return DateFormat('d MMM, h:mm a').format(t);
}

/// Opens a notification's deep link: tab roots switch tabs, everything else is pushed.
void openNotificationRoute(BuildContext context, String route) {
  const tabs = {
    RoutePaths.home,
    RoutePaths.academics,
    RoutePaths.fees,
    RoutePaths.messages,
    RoutePaths.more,
  };
  if (tabs.contains(Uri.parse(route).path)) {
    context.go(route);
  } else {
    context.push(route);
  }
}
