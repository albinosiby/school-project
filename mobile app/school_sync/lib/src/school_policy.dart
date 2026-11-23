import 'dart:convert';

class SchoolSlot {
  const SchoolSlot({
    required this.id,
    required this.label,
    required this.start,
    required this.end,
    this.isBreak = false,
    this.isGap = false,
  });
  final String id, label, start, end;
  final bool isBreak, isGap;
  int get startMinute => minutes(start);
  int get endMinute => minutes(end);
  static int minutes(String value) {
    final parts = value.split(':');
    return (int.tryParse(parts.first) ?? 0) * 60 + (parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
  }
}

class SchoolTerm {
  const SchoolTerm(this.name, this.start, this.end);
  final String name;
  final DateTime start, end;
}

/// Only the allowlisted school/mobile projection is accepted here.
class SchoolPolicy {
  const SchoolPolicy({
    this.academicYear = '',
    this.minimumAttendance = 75,
    this.rangeStart,
    this.rangeEnd,
    this.workingDays = const [1, 2, 3, 4, 5, 6],
    this.utcOffsetMinutes = 330,
    this.slots = const [],
    this.version = '',
    this.terms = const [],
  });
  final String academicYear, version;
  final double minimumAttendance;
  final DateTime? rangeStart, rangeEnd;
  final List<int> workingDays;
  final int utcOffsetMinutes;
  final List<SchoolSlot> slots;
  final List<SchoolTerm> terms;
  factory SchoolPolicy.fromJson(Map<String, dynamic> value) {
    final range = value['academicRange'] is Map ? value['academicRange'] as Map : const {};
    var period = 0, pause = 0;
    final slots = <SchoolSlot>[];
    for (final row in (value['schedule'] as List?) ?? const []) {
      if (row is! Map ||
          !RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch('${row['start']}') ||
          !RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch('${row['end']}'))
        continue;
      final rest = row['isBreak'] == true || row['isGap'] == true;
      slots.add(
        SchoolSlot(
          id: rest ? 'BREAK${++pause}' : 'P${++period}',
          label: '${row['label'] ?? ''}',
          start: '${row['start']}',
          end: '${row['end']}',
          isBreak: row['isBreak'] == true,
          isGap: row['isGap'] == true,
        ),
      );
    }
    final min = (value['minimumAttendance'] as num?)?.toDouble();
    return SchoolPolicy(
      academicYear: '${value['academicYear'] ?? ''}',
      minimumAttendance: min != null && min.isFinite && min >= 0 && min <= 100 ? min : 75,
      rangeStart: DateTime.tryParse('${range['start'] ?? ''}'),
      rangeEnd: DateTime.tryParse('${range['end'] ?? ''}'),
      workingDays: value['workingDays'] is List
          ? List<int>.unmodifiable((value['workingDays'] as List).whereType<int>().where((d) => d >= 1 && d <= 7))
          : const [1, 2, 3, 4, 5, 6],
      utcOffsetMinutes: (value['utcOffsetMinutes'] as num?)?.toInt() ?? 330,
      slots: List.unmodifiable(slots),
      terms: [
        for (final row in value['terms'] as List? ?? const [])
          if (row is Map && DateTime.tryParse('${row['start']}') != null && DateTime.tryParse('${row['end']}') != null)
            SchoolTerm('${row['name'] ?? row['id'] ?? 'Term'}', DateTime.parse('${row['start']}'), DateTime.parse('${row['end']}')),
      ],
      version: jsonEncode(value),
    );
  }
  bool includes(DateTime date, {DateTime? admissionDate}) {
    final day = DateTime(date.year, date.month, date.day);
    return (rangeStart == null || !day.isBefore(rangeStart!)) &&
        (rangeEnd == null || !day.isAfter(rangeEnd!)) &&
        (admissionDate == null || !day.isBefore(admissionDate));
  }

  DateTime schoolTime([DateTime? now]) => (now ?? DateTime.now()).toUtc().add(Duration(minutes: utcOffsetMinutes));
  String termWeekLabel(DateTime date) {
    final day = DateTime.utc(date.year, date.month, date.day);
    for (final term in terms) {
      final start = DateTime.utc(term.start.year, term.start.month, term.start.day);
      final end = DateTime.utc(term.end.year, term.end.month, term.end.day);
      if (!day.isBefore(start) && !day.isAfter(end)) {
        final monday = start.subtract(Duration(days: start.weekday - 1));
        return '${term.name} · Week ${day.difference(monday).inDays ~/ 7 + 1}';
      }
    }
    return academicYear.isEmpty ? 'Academic calendar' : 'AY $academicYear';
  }

  String get thresholdLabel =>
      minimumAttendance == minimumAttendance.roundToDouble() ? minimumAttendance.toInt().toString() : minimumAttendance.toString();
}

/// Compatibility bridge for the teacher app's existing synchronous timetable helpers.
/// Updated by the school adapter; cleared with the authenticated data store.
class SchoolPolicyRuntime {
  static SchoolPolicy current = const SchoolPolicy();
  static void clear() => current = const SchoolPolicy();
}
