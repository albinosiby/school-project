import 'package:equatable/equatable.dart';

/// Working days (Mon–Sat) between two ISO dates, inclusive.
int leaveDays(String start, String end) {
  final s = DateTime.tryParse(start), e = DateTime.tryParse(end);
  if (s == null || e == null) return 0;
  var n = 0;
  for (var d = s; !d.isAfter(e); d = d.add(const Duration(days: 1))) {
    if (d.weekday != DateTime.sunday) n++;
  }
  return n;
}

class LeaveQuota extends Equatable {
  const LeaveQuota({required this.id, required this.name, required this.short, required this.total, required this.used});
  final String id, name, short;
  final int total, used;
  int get available => total - used;
  factory LeaveQuota.fromJson(Map<String, dynamic> j) => LeaveQuota(
        id: j['id'] as String, name: j['name'] as String? ?? '', short: j['short'] as String? ?? '',
        total: (j['total'] as num?)?.toInt() ?? 0, used: (j['used'] as num?)?.toInt() ?? 0,
      );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'short': short, 'total': total, 'used': used};
  @override
  List<Object?> get props => [id, name, short, total, used];
}

/// A class period that can be handed over to a substitute.
class HandoverPeriod extends Equatable {
  const HandoverPeriod({required this.id, required this.time, required this.label, required this.cls, required this.room});
  final String id, time, label, cls, room;
  factory HandoverPeriod.fromJson(Map<String, dynamic> j) => HandoverPeriod(
        id: j['id'] as String, time: j['time'] as String? ?? '', label: j['label'] as String? ?? '', cls: j['cls'] as String? ?? '', room: j['room'] as String? ?? '',
      );
  @override
  List<Object?> get props => [id, time, label, cls, room];
}

class Faculty extends Equatable {
  const Faculty({required this.id, required this.name, required this.role, required this.free});
  final String id, name, role, free;
  factory Faculty.fromJson(Map<String, dynamic> j) =>
      Faculty(id: j['id'] as String, name: j['name'] as String? ?? '', role: j['role'] as String? ?? '', free: j['free'] as String? ?? '');
  @override
  List<Object?> get props => [id, name, role, free];
}

class Handover extends Equatable {
  const Handover({required this.periodId, required this.label, required this.time, required this.cls, required this.room, required this.subId, required this.subName, required this.topic, this.notes = '', this.plan, this.notified = true});
  final String periodId, label, time, cls, room, subId, subName, topic, notes;
  final String? plan;
  final bool notified;
  factory Handover.fromJson(Map<String, dynamic> j) => Handover(
        periodId: j['periodId'] as String? ?? '', label: j['label'] as String? ?? '', time: j['time'] as String? ?? '', cls: j['cls'] as String? ?? '',
        room: j['room'] as String? ?? '', subId: j['subId'] as String? ?? '', subName: j['subName'] as String? ?? '', topic: j['topic'] as String? ?? '',
        notes: j['notes'] as String? ?? '', plan: j['plan'] as String?, notified: j['notified'] != false,
      );
  Map<String, dynamic> toJson() => {
        'periodId': periodId, 'label': label, 'time': time, 'cls': cls, 'room': room, 'subId': subId, 'subName': subName,
        'topic': topic, 'notes': notes, 'plan': plan, 'notified': notified,
      };
  @override
  List<Object?> get props => [periodId, subId, topic, notes, plan, notified];
}

/// The teacher's own leave application. status: Pending | Approved | Rejected.
class LeaveApplication extends Equatable {
  const LeaveApplication({this.id = '', required this.type, required this.start, required this.end, required this.days, this.coverage = 'Full Day', required this.reason, this.status = 'Pending', this.by = '', this.handovers = const [], this.doc, this.createdAt = ''});
  final String id, type, start, end, coverage, reason, status, by, createdAt;
  final int days;
  final List<Handover> handovers;
  final String? doc;
  factory LeaveApplication.fromJson(Map<String, dynamic> j) => LeaveApplication(
        id: j['id'] as String? ?? '', type: j['type'] as String? ?? '', start: j['start'] as String? ?? '', end: j['end'] as String? ?? '',
        days: (j['days'] as num?)?.toInt() ?? 0, coverage: j['coverage'] as String? ?? 'Full Day', reason: j['reason'] as String? ?? '',
        status: j['status'] as String? ?? 'Pending', by: j['by'] as String? ?? '',
        handovers: [for (final h in j['handovers'] as List? ?? const []) Handover.fromJson(Map<String, dynamic>.from(h as Map))],
        doc: j['doc'] as String?, createdAt: j['createdAt'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'type': type, 'start': start, 'end': end, 'days': days, 'coverage': coverage, 'reason': reason,
        'status': status, 'by': by, 'handovers': [for (final h in handovers) h.toJson()], 'doc': doc, 'createdAt': createdAt,
      };
  @override
  List<Object?> get props => [id, type, start, end, days, coverage, reason, status, by, handovers, doc, createdAt];
}
