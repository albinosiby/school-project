import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/local_database_service.dart';

/// Date/time formatting and JSON record accessors shared by modules.
String isoOf(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
String todayIso() => isoOf(DateTime.now());
DateTime? parseIso(String? s) => DateTime.tryParse(s ?? '');
String plusDays(int n) => isoOf(DateTime.now().add(Duration(days: n)));

String fmtDate(String iso, {bool year = false}) {
  final d = parseIso(iso);
  if (d == null) return iso;
  return DateFormat(year ? 'EEE, d MMM yyyy' : 'EEE, d MMM').format(d);
}

String fmtDay(String iso) {
  final d = parseIso(iso);
  if (d == null) return iso;
  if (iso == todayIso()) return 'Today';
  if (iso == plusDays(1)) return 'Tomorrow';
  return DateFormat('EEEE').format(d);
}

TimeOfDay parseTime(String hhmm) {
  final p = hhmm.split(':');
  return TimeOfDay(hour: int.tryParse(p.first) ?? 0, minute: int.tryParse(p.length > 1 ? p[1] : '0') ?? 0);
}

String hhmm(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

String fmtTime(String t) {
  final x = parseTime(t);
  return DateFormat('hh:mm a').format(DateTime(2000, 1, 1, x.hour, x.minute));
}

String addMins(String t, int mins) {
  final x = parseTime(t);
  final d = DateTime(2000, 1, 1, x.hour, x.minute).add(Duration(minutes: mins));
  return hhmm(TimeOfDay(hour: d.hour, minute: d.minute));
}

/// Timestamp label used in message lists.
String relTime(String? iso) {
  final d = DateTime.tryParse(iso ?? '');
  if (d == null) return '';
  final n = DateTime.now();
  final day = DateTime(d.year, d.month, d.day);
  final today = DateTime(n.year, n.month, n.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return DateFormat('h:mm a').format(d);
  if (diff == 1) return 'Yesterday';
  return DateFormat('d MMM').format(d);
}

String clock(String? iso) {
  final d = DateTime.tryParse(iso ?? '');
  return d == null ? '' : DateFormat('h:mm a').format(d);
}

String nowIso() => DateTime.now().toIso8601String();

extension RecX on Rec {
  String s(String k) => '${this[k] ?? ''}';
  int i(String k) => (this[k] as num?)?.toInt() ?? 0;
  double d(String k) => (this[k] as num?)?.toDouble() ?? 0;
  bool b(String k) => this[k] == true;
  List<Rec> l(String k) => [for (final e in (this[k] as List? ?? const [])) Map<String, dynamic>.from(e as Map)];
  List<String> sl(String k) => [for (final e in (this[k] as List? ?? const [])) '$e'];
  Rec? m(String k) => this[k] is Map ? Map<String, dynamic>.from(this[k] as Map) : null;
}

