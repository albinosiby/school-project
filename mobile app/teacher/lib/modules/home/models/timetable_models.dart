import 'package:equatable/equatable.dart';

// ---------------------------------------------------------------------------
// Bell schedule (shared by Home, Timetable and the weekly grid)
// ---------------------------------------------------------------------------

class Slot {
  const Slot(this.id, this.start, this.end, {this.label, this.isBreak = false});
  final String id, start, end;
  final String? label;
  final bool isBreak;
  int get startMin => mins(start);
  int get endMin => mins(end);
  int get length => endMin - startMin;
}

const kSlots = <Slot>[
  Slot('P1', '08:30', '09:15'),
  Slot('P2', '09:15', '10:00'),
  Slot('BRK', '10:00', '10:15', label: 'Short Recess', isBreak: true),
  Slot('P3', '10:15', '11:00'),
  Slot('P4', '11:00', '11:45'),
  Slot('LNC', '11:45', '12:30', label: 'Lunch Break', isBreak: true),
  Slot('P5', '12:30', '13:15'),
  Slot('P6', '13:15', '14:00'),
];

const kDayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const kDayLong = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const kMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

int mins(String hhmm) {
  final p = hhmm.split(':');
  return (int.tryParse(p[0]) ?? 0) * 60 + (p.length > 1 ? int.tryParse(p[1]) ?? 0 : 0);
}

/// "13:15" -> "1:15 PM".
String t12(String hhmm, {bool suffix = true}) {
  final m = mins(hhmm);
  final h = m ~/ 60, mm = m % 60;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:${mm.toString().padLeft(2, '0')}${suffix ? (h >= 12 ? ' PM' : ' AM') : ''}';
}

String hhmmOf(int minute) => '${(minute ~/ 60).toString().padLeft(2, '0')}:${(minute % 60).toString().padLeft(2, '0')}';

DateTime mondayOf(DateTime d) {
  final base = DateTime(d.year, d.month, d.day);
  return base.subtract(Duration(days: base.weekday - 1));
}

String dayMonth(DateTime d) => '${d.day} ${kMonths[d.month - 1]}';

/// "Term 2 • Week N", term starting 1 September.
int termWeek(DateTime d) {
  final y = d.month >= 9 ? d.year : d.year - 1;
  final start = mondayOf(DateTime(y, 9, 1));
  return DateTime(d.year, d.month, d.day).difference(start).inDays ~/ 7 + 1;
}

/// The moment the UI treats as "now". During school hours on a school day it is the
/// real clock; otherwise it falls back to the design example (Monday, 10:40, period 3).
class SchoolNow {
  const SchoolNow(this.at, this.day, this.simulated);
  final DateTime at;
  final int day; // 1 = Mon .. 6 = Sat
  final bool simulated;
  int get minute => at.hour * 60 + at.minute;
  DateTime get monday => mondayOf(at);
  DateTime dateOfDay(int d) => monday.add(Duration(days: d - 1));
}

SchoolNow schoolNow([DateTime? real]) {
  final r = real ?? DateTime.now();
  final m = r.hour * 60 + r.minute;
  final inHours = r.weekday <= 6 && m >= kSlots.first.startMin && m < kSlots.last.endMin;
  if (inHours) return SchoolNow(r, r.weekday, false);
  final mon = r.weekday == 7 ? mondayOf(r).add(const Duration(days: 7)) : mondayOf(r);
  return SchoolNow(DateTime(mon.year, mon.month, mon.day, 10, 40), 1, true);
}

enum PStatus { done, live, upcoming }

Slot slotOf(String id) => kSlots.firstWhere((s) => s.id == id, orElse: () => kSlots.first);

PStatus statusOf(Slot s, int day, SchoolNow now) {
  if (day < now.day) return PStatus.done;
  if (day > now.day) return PStatus.upcoming;
  if (now.minute >= s.endMin) return PStatus.done;
  if (now.minute >= s.startMin) return PStatus.live;
  return PStatus.upcoming;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

enum PeriodKind { core, sub, remedial, prep }

String kindLabel(PeriodKind k) => switch (k) {
      PeriodKind.sub => 'Sub Duty',
      PeriodKind.remedial => 'Remedial Lab',
      PeriodKind.prep => 'Free / Prep',
      PeriodKind.core => 'Core Class',
    };

/// One timetable period (collection `tt_periods`).
class Period extends Equatable {
  const Period({required this.id, required this.day, required this.slot, required this.kind, this.classId, required this.label, required this.subject, required this.short, required this.room, this.topic = '', this.subId});
  final String id, slot, label, subject, short, room, topic;
  final int day;
  final PeriodKind kind;
  final String? classId, subId;

  /// "3" for slot "P3".
  String get no => slot.substring(1);

  factory Period.fromJson(Map<String, dynamic> j) => Period(
        id: j['id'] as String, day: (j['day'] as num?)?.toInt() ?? 1, slot: j['slot'] as String? ?? 'P1',
        kind: PeriodKind.values.asNameMap()[j['kind']] ?? PeriodKind.core, classId: j['classId'] as String?,
        label: j['label'] as String? ?? '', subject: j['subject'] as String? ?? '', short: j['short'] as String? ?? '',
        room: j['room'] as String? ?? '', topic: j['topic'] as String? ?? '', subId: j['subId'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'day': day, 'slot': slot, 'kind': kind.name, 'classId': ?classId, 'label': label, 'subject': subject,
        'short': short, 'room': room, 'topic': topic, 'subId': ?subId,
      };
  Period copyWith({PeriodKind? kind, String? label, String? subject, String? room}) => Period(
        id: id, day: day, slot: slot, kind: kind ?? this.kind, classId: classId, label: label ?? this.label, subject: subject ?? this.subject,
        short: short, room: room ?? this.room, topic: topic, subId: subId,
      );

  @override
  List<Object?> get props => [id, day, slot, kind, classId, label, subject, short, room, topic, subId];
}

class SubTask extends Equatable {
  const SubTask({required this.title, required this.sub, this.done = false});
  final String title, sub;
  final bool done;
  factory SubTask.fromJson(Map<String, dynamic> j) => SubTask(title: j['t'] as String? ?? '', sub: j['s'] as String? ?? '', done: j['done'] == true);
  Map<String, dynamic> toJson() => {'t': title, 's': sub, 'done': done};
  SubTask copyWith({bool? done}) => SubTask(title: title, sub: sub, done: done ?? this.done);
  @override
  List<Object?> get props => [title, sub, done];
}

class SubFile extends Equatable {
  const SubFile({required this.name, required this.meta});
  final String name, meta;
  factory SubFile.fromJson(Map<String, dynamic> j) => SubFile(name: j['name'] as String? ?? '', meta: j['meta'] as String? ?? '');
  Map<String, dynamic> toJson() => {'name': name, 'meta': meta};
  @override
  List<Object?> get props => [name, meta];
}

class SubContact extends Equatable {
  const SubContact({required this.name, required this.role});
  final String name, role;
  factory SubContact.fromJson(Map<String, dynamic> j) => SubContact(name: j['name'] as String? ?? '', role: j['role'] as String? ?? '');
  Map<String, dynamic> toJson() => {'name': name, 'role': role};
  @override
  List<Object?> get props => [name, role];
}

enum SubStatus { pending, accepted, declined }

/// A substitution duty with its lesson brief (collection `tt_subs`).
class Substitution extends Equatable {
  const Substitution({
    required this.id, required this.day, required this.slot, required this.status, required this.classLabel, required this.subject, this.classId,
    required this.faculty, required this.dept, required this.role, required this.room, required this.posted, required this.tag, required this.chapter,
    required this.objective, required this.directive, this.tasks = const [], this.files = const [], this.contacts = const [],
  });
  final String id, slot, classLabel, subject, faculty, dept, role, room, posted, tag, chapter, objective, directive;
  final String? classId;
  final int day;
  final SubStatus status;
  final List<SubTask> tasks;
  final List<SubFile> files;
  final List<SubContact> contacts;

  int get doneCount => tasks.where((t) => t.done).length;

  static List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) Map<String, dynamic>.from(e as Map)];

  factory Substitution.fromJson(Map<String, dynamic> j) => Substitution(
        id: j['id'] as String, day: (j['day'] as num?)?.toInt() ?? 1, slot: j['slot'] as String? ?? 'P1',
        status: SubStatus.values.asNameMap()[j['status']] ?? SubStatus.pending, classLabel: j['classLabel'] as String? ?? '',
        subject: j['subject'] as String? ?? '', classId: j['classId'] as String?, faculty: j['faculty'] as String? ?? '',
        dept: j['dept'] as String? ?? '', role: j['role'] as String? ?? '', room: j['room'] as String? ?? '', posted: j['posted'] as String? ?? '',
        tag: j['tag'] as String? ?? '', chapter: j['chapter'] as String? ?? '', objective: j['objective'] as String? ?? '',
        directive: j['directive'] as String? ?? '',
        tasks: [for (final t in _l(j['tasks'])) SubTask.fromJson(t)],
        files: [for (final f in _l(j['files'])) SubFile.fromJson(f)],
        contacts: [for (final c in _l(j['contacts'])) SubContact.fromJson(c)],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'day': day, 'slot': slot, 'status': status.name, 'classLabel': classLabel, 'subject': subject, 'classId': ?classId,
        'faculty': faculty, 'dept': dept, 'role': role, 'room': room, 'posted': posted, 'tag': tag, 'chapter': chapter,
        'objective': objective, 'directive': directive,
        'tasks': [for (final t in tasks) t.toJson()], 'files': [for (final f in files) f.toJson()], 'contacts': [for (final c in contacts) c.toJson()],
      };
  Substitution copyWith({SubStatus? status, List<SubTask>? tasks}) =>
      Substitution.fromJson({...toJson(), 'status': (status ?? this.status).name, 'tasks': [for (final t in tasks ?? this.tasks) t.toJson()]});

  @override
  List<Object?> get props => [id, day, slot, status, classLabel, subject, classId, faculty, dept, role, room, posted, tag, chapter, objective, directive, tasks, files, contacts];
}

/// Periods of one weekday ordered by slot. A declined substitution becomes a free period.
List<Period> periodsFor(List<Period> all, List<Substitution> subs, int day) {
  final declined = {for (final s in subs) if (s.status == SubStatus.declined) s.id};
  int idx(String slot) => kSlots.indexWhere((x) => x.id == slot);
  final rows = all.where((p) => p.day == day).toList()..sort((a, b) => idx(a.slot).compareTo(idx(b.slot)));
  return [
    for (final p in rows)
      if (p.kind == PeriodKind.sub && declined.contains(p.subId)) p.copyWith(kind: PeriodKind.prep, label: 'Prep', subject: 'Free / Prep', room: 'Staff Room 2') else p,
  ];
}

/// Deterministic "attended" count for a finished period (simulated register).
int attendedCount(Period p, int students) => students - p.id.codeUnits.fold<int>(0, (a, b) => a + b) % 3;

/// What is happening right now (or next) for a school moment.
class NowInfo {
  const NowInfo({this.live, this.next, this.brk});
  final Period? live, next;
  final Slot? brk;
}

NowInfo nowInfo(List<Period> dayPeriods, SchoolNow now) {
  Period? live, next;
  for (final p in dayPeriods) {
    final st = statusOf(slotOf(p.slot), now.day, now);
    if (st == PStatus.live) live = p;
    if (st == PStatus.upcoming && next == null) next = p;
  }
  Slot? brk;
  if (live == null) {
    for (final sl in kSlots) {
      if (sl.isBreak && now.minute >= sl.startMin && now.minute < sl.endMin) brk = sl;
    }
  }
  return NowInfo(live: live, next: next, brk: brk);
}
