import 'package:intl/intl.dart';

/// Date helpers for the tasks module (ISO date-times, relative day labels).
DateTime? parseDt(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
DateTime dayOf(DateTime d) => DateTime(d.year, d.month, d.day);
int daysFromToday(DateTime d) => dayOf(d).difference(dayOf(DateTime.now())).inDays;

String fmtClock(DateTime d) => DateFormat('hh:mm a').format(d);
String fmtShort(DateTime d) => DateFormat('MMM d').format(d);
String fmtLong(DateTime d) => DateFormat('d MMM, yyyy').format(d);
String fmtDayFull(DateTime d) => DateFormat('EEE, d MMM yyyy').format(d);

/// "Today" / "Tomorrow" / "Yesterday" / "Oct 28".
String relDay(DateTime d) => switch (daysFromToday(d)) { 0 => 'Today', 1 => 'Tomorrow', -1 => 'Yesterday', _ => fmtShort(d) };

String agoLabel(DateTime d) {
  final m = DateTime.now().difference(d).inMinutes;
  if (m < 1) return 'just now';
  if (m < 60) return '${m}m ago';
  if (m < 60 * 24) return '${m ~/ 60}h ago';
  return '${m ~/ (60 * 24)}d ago';
}
