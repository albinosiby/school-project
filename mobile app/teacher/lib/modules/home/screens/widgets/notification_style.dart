import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/notification_models.dart';
import '../../models/timetable_models.dart';

/// Icon + tone per notification type.
(IconData, Tone) notifStyle(String type) => switch (type) {
      'leave' => (Icons.event_busy_outlined, Tone.warning),
      'homework' => (Icons.assignment_turned_in_outlined, Tone.brand),
      'exam' => (Icons.edit_note_rounded, Tone.purple),
      'chat' => (Icons.chat_bubble_outline_rounded, Tone.neutral),
      'circular' => (Icons.campaign_outlined, Tone.brand),
      'attendance' => (Icons.verified_user_outlined, Tone.success),
      _ => (Icons.notifications_none_rounded, Tone.neutral),
    };

DateTime notifTime(AppNotification n) => DateTime.tryParse(n.at) ?? DateTime.now();

/// "now", "10m ago", "2h ago" today; otherwise the clock time.
String notifAgo(DateTime t, [DateTime? ref]) {
  final now = ref ?? DateTime.now();
  final d = now.difference(t);
  final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
  if (sameDay && d.inMinutes < 1) return 'now';
  if (sameDay && d.inMinutes < 60) return '${d.inMinutes}m ago';
  if (sameDay && d.inHours < 24) return '${d.inHours}h ago';
  return t12('${t.hour}:${t.minute}');
}

String notifDateLabel(DateTime t) => '${const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][t.weekday - 1]}, ${t.day} ${kMonths[t.month - 1]}';

String notifGroup(DateTime t, DateTime now) {
  final a = DateTime(t.year, t.month, t.day), b = DateTime(now.year, now.month, now.day);
  final diff = b.difference(a).inDays;
  return diff <= 0 ? 'TODAY' : diff == 1 ? 'YESTERDAY' : diff < 7 ? 'EARLIER THIS WEEK' : 'OLDER';
}
