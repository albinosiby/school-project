import 'package:intl/intl.dart';

/// Date/time helpers shared by modules. Dates are plain [DateTime]s; use [dateOnly] to compare days.
DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);
bool sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;
DateTime today() => dateOnly(DateTime.now());
DateTime plusDays(int n, {DateTime? from}) =>
    dateOnly(from ?? DateTime.now()).add(Duration(days: n));

String fmtDate(DateTime d, {bool year = false}) =>
    DateFormat(year ? 'EEE, d MMM yyyy' : 'EEE, d MMM').format(d);
String fmtShort(DateTime d) => DateFormat('d MMM').format(d);
String fmtMonth(DateTime d) => DateFormat('MMMM yyyy').format(d);
String fmtClock(DateTime d) => DateFormat('h:mm a').format(d);

/// "Today", "Tomorrow", "Yesterday" or the weekday/date.
String fmtDay(DateTime d, {DateTime? now}) {
  final n = dateOnly(now ?? DateTime.now());
  final diff = dateOnly(d).difference(n).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Tomorrow';
  if (diff == -1) return 'Yesterday';
  return fmtDate(d);
}

/// Minutes since midnight -> "09:30 AM".
String fmtMinute(int minute) => DateFormat(
  'hh:mm a',
).format(DateTime(2000, 1, 1, minute ~/ 60, minute % 60));

/// Timestamp label used in message lists.
String relTime(DateTime d, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final diff = dateOnly(n).difference(dateOnly(d)).inDays;
  if (diff == 0) return DateFormat('h:mm a').format(d);
  if (diff == 1) return 'Yesterday';
  return DateFormat('d MMM').format(d);
}

String inr(num amount) => NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 0,
).format(amount);
