import 'package:equatable/equatable.dart';
import 'tasks_format.dart';

String _s(Object? v) => v is String ? v : '';
String? _sn(Object? v) => v is String && v.isNotEmpty ? v : null;

class AgendaItem extends Equatable {
  const AgendaItem(this.topic, this.minutes);
  final String topic;
  final int minutes;
  factory AgendaItem.fromJson(Map<String, dynamic> j) => AgendaItem(_s(j['t']), (j['min'] as num?)?.toInt() ?? 0);
  Map<String, dynamic> toJson() => {'t': topic, 'min': minutes};
  @override
  List<Object?> get props => [topic, minutes];
}

class DutyStaff extends Equatable {
  const DutyStaff(this.name, this.role, {this.relief = false});
  final String name, role;
  final bool relief;
  factory DutyStaff.fromJson(Map<String, dynamic> j) => DutyStaff(_s(j['name']), _s(j['role']), relief: j['relief'] == true);
  Map<String, dynamic> toJson() => {'name': name, 'role': role, 'relief': relief};
  @override
  List<Object?> get props => [name, role, relief];
}

class DutyDoc extends Equatable {
  const DutyDoc(this.name, this.size, {this.kind = 'pdf'});
  final String name, size, kind;
  factory DutyDoc.fromJson(Map<String, dynamic> j) => DutyDoc(_s(j['name']), _s(j['size']), kind: j['kind'] as String? ?? 'pdf');
  Map<String, dynamic> toJson() => {'name': name, 'size': size, 'kind': kind};
  @override
  List<Object?> get props => [name, size, kind];
}

List<Map<String, dynamic>> _maps(Object? v) => [for (final e in (v as List? ?? const [])) Map<String, dynamic>.from(e as Map)];

/// An assigned duty (`tk_duties`): exam invigilation, staff meeting, sports or gate duty.
class Duty extends Equatable {
  const Duty({
    required this.id, required this.type, required this.title, required this.start, this.end = '', this.venue = '', this.status = 'upcoming',
    this.code, this.subtitle = '', this.venue2 = '', this.role, this.role2 = '', this.reportNote, this.pick, this.lead, this.candidates = '',
    this.candidates2 = '', this.mandatory = false, this.chair, this.tag, this.agendaTitle, this.floor, this.agenda = const [], this.preRead,
    this.staff = const [], this.docs = const [], this.desk, this.joinedAt, this.extra = const {},
  });

  final String id, type, title, start, end, venue, status, subtitle, venue2, role2, candidates, candidates2;
  final String? code, role, reportNote, pick, lead, chair, tag, agendaTitle, floor, desk, joinedAt;
  final bool mandatory;
  final List<AgendaItem> agenda;
  final DutyDoc? preRead;
  final List<DutyStaff> staff;
  final List<DutyDoc> docs;
  final Map<String, dynamic> extra;

  static const _known = {
    'id', 'type', 'title', 'start', 'end', 'venue', 'status', 'code', 'subtitle', 'venue2', 'role', 'role2', 'reportNote', 'pick', 'lead', 'candidates',
    'candidates2', 'mandatory', 'chair', 'tag', 'agendaTitle', 'floor', 'agenda', 'preRead', 'staff', 'docs', 'desk', 'joinedAt',
  };

  bool get isDone => status == 'done';
  DateTime? get startAt => parseDt(start);
  DateTime? get endAt => parseDt(end);
  bool get isToday => startAt != null && daysFromToday(startAt!) == 0;
  String get typeLabel => dutyTypeLabel(type);

  /// "03:30 PM – 04:30 PM".
  String get timeRange {
    final a = startAt, b = endAt;
    if (a == null) return '';
    return '${fmtClock(a)}${b == null ? '' : ' – ${fmtClock(b)}'}';
  }

  /// "Tomorrow, Oct 24 • 09:00 AM – 12:00 PM".
  String get when {
    final a = startAt;
    return a == null ? '' : '${relDay(a)}, ${fmtShort(a)} • $timeRange';
  }

  /// "Completed" / "In progress" / "In 3 hrs".
  String get untilLabel {
    final a = startAt, b = endAt;
    if (a == null) return '';
    final now = DateTime.now();
    if (b != null && now.isAfter(b)) return 'Completed';
    if (now.isAfter(a)) return 'In progress';
    final m = a.difference(now).inMinutes;
    if (m < 60) return 'In $m mins';
    if (m < 60 * 24) return 'In ${m ~/ 60} hrs';
    return 'In ${m ~/ (60 * 24)} days';
  }

  /// "Starts in 18h" (or [untilLabel] once started).
  String get startsIn {
    final a = startAt;
    if (a == null || !a.isAfter(DateTime.now())) return untilLabel;
    final m = a.difference(DateTime.now()).inMinutes;
    return m < 60 ? 'Starts in ${m}m' : m < 60 * 48 ? 'Starts in ${m ~/ 60}h' : 'Starts in ${m ~/ (60 * 24)}d';
  }

  factory Duty.fromJson(Map<String, dynamic> j) => Duty(
        id: _s(j['id']), type: _s(j['type']), title: _s(j['title']), start: _s(j['start']), end: _s(j['end']), venue: _s(j['venue']),
        status: j['status'] as String? ?? 'upcoming', code: _sn(j['code']), subtitle: _s(j['subtitle']), venue2: _s(j['venue2']), role: _sn(j['role']),
        role2: _s(j['role2']), reportNote: _sn(j['reportNote']), pick: _sn(j['pick']), lead: _sn(j['lead']), candidates: _s(j['candidates']),
        candidates2: _s(j['candidates2']), mandatory: j['mandatory'] == true, chair: _sn(j['chair']), tag: _sn(j['tag']), agendaTitle: _sn(j['agendaTitle']),
        floor: _sn(j['floor']), agenda: [for (final m in _maps(j['agenda'])) AgendaItem.fromJson(m)],
        preRead: j['preRead'] is Map ? DutyDoc.fromJson(Map<String, dynamic>.from(j['preRead'] as Map)) : null,
        staff: [for (final m in _maps(j['staff'])) DutyStaff.fromJson(m)], docs: [for (final m in _maps(j['docs'])) DutyDoc.fromJson(m)],
        desk: _sn(j['desk']), joinedAt: _sn(j['joinedAt']),
        extra: {for (final e in j.entries) if (!_known.contains(e.key)) e.key: e.value},
      );

  Map<String, dynamic> toJson() => {
        ...extra, 'id': id, 'type': type, 'title': title, 'start': start, 'end': end, 'venue': venue, 'status': status, 'code': ?code,
        'subtitle': subtitle, 'venue2': venue2, 'role': ?role, 'role2': role2, 'reportNote': ?reportNote, 'pick': ?pick, 'lead': ?lead,
        'candidates': candidates, 'candidates2': candidates2, 'mandatory': mandatory, 'chair': ?chair, 'tag': ?tag, 'agendaTitle': ?agendaTitle,
        'floor': ?floor, 'agenda': [for (final a in agenda) a.toJson()], 'preRead': ?preRead?.toJson(), 'staff': [for (final s in staff) s.toJson()],
        'docs': [for (final d in docs) d.toJson()], 'desk': ?desk, 'joinedAt': ?joinedAt,
      };

  @override
  List<Object?> get props => [id, type, title, start, end, venue, status, subtitle, role, chair, agenda, staff, docs, joinedAt, extra];
}

String dutyTypeLabel(String? t) => switch (t) { 'exam' => 'Exam Invigilation', 'meeting' => 'Staff Meeting', 'sports' => 'Sports Duty', 'gate' => 'Gate Duty', _ => 'Duty' };

/// Faculty offered for duty swaps (plus the duty's own staff).
const kFacultyNames = ['Mrs. Sunita Kapoor', 'Ms. Anjali Mehta', 'Mr. Rajesh Deshmukh', 'Mr. Vikram Nair'];

/// A duty swap request (`tk_swaps`).
class SwapRequest extends Equatable {
  const SwapRequest({
    this.id = '', required this.dutyId, required this.dutyTitle, required this.swapWith, required this.returnDate, required this.returnFrom,
    required this.returnTo, required this.reason, required this.note, this.status = 'pending', required this.createdAt,
  });
  final String id, dutyId, dutyTitle, swapWith, returnDate, returnFrom, returnTo, reason, note, status, createdAt;

  bool get isPending => status == 'pending';

  factory SwapRequest.fromJson(Map<String, dynamic> j) => SwapRequest(
        id: _s(j['id']), dutyId: _s(j['dutyId']), dutyTitle: _s(j['dutyTitle']), swapWith: _s(j['swapWith']), returnDate: _s(j['returnDate']),
        returnFrom: _s(j['returnFrom']), returnTo: _s(j['returnTo']), reason: _s(j['reason']), note: _s(j['note']),
        status: j['status'] as String? ?? 'pending', createdAt: _s(j['createdAt']),
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'dutyId': dutyId, 'dutyTitle': dutyTitle, 'swapWith': swapWith, 'returnDate': returnDate, 'returnFrom': returnFrom,
        'returnTo': returnTo, 'reason': reason, 'note': note, 'status': status, 'createdAt': createdAt,
      };

  @override
  List<Object?> get props => [id, dutyId, swapWith, returnDate, returnFrom, returnTo, reason, note, status, createdAt];
}
