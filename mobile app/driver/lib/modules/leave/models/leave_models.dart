import 'package:equatable/equatable.dart';

/// `tr_crew_leaves/{id}` (contract 14.5).
class CrewLeave extends Equatable {
  const CrewLeave({
    required this.id,
    required this.crewId,
    required this.type,
    required this.from,
    required this.to,
    required this.reason,
    this.name = '',
    this.role = '',
    this.busId = '',
    this.status = 'Pending',
    this.appliedAt,
    this.decidedBy,
    this.decidedAt,
    this.decisionNote = '',
  });
  final String id, crewId, type, from, to, reason, name, role, busId, status, decisionNote;
  final DateTime? appliedAt, decidedAt;
  final String? decidedBy;

  static const types = ['Casual', 'Sick', 'Emergency', 'Other'];

  int get days => (DateTime.tryParse(to)?.difference(DateTime.tryParse(from) ?? DateTime.now()).inDays ?? 0) + 1;
  bool get isPending => status == 'Pending';

  factory CrewLeave.fromJson(Map<String, dynamic> j, {String? id}) => CrewLeave(
    id: id ?? '${j['id'] ?? ''}', crewId: '${j['crewId'] ?? ''}', name: '${j['name'] ?? ''}', role: '${j['role'] ?? ''}',
    busId: '${j['busId'] ?? ''}', type: '${j['type'] ?? 'Casual'}', from: '${j['from'] ?? ''}', to: '${j['to'] ?? ''}',
    reason: '${j['reason'] ?? ''}', status: '${j['status'] ?? 'Pending'}',
    appliedAt: DateTime.tryParse('${j['appliedAt'] ?? ''}')?.toLocal(),
    decidedBy: j['decidedBy'] == null ? null : '${j['decidedBy']}',
    decidedAt: DateTime.tryParse('${j['decidedAt'] ?? ''}')?.toLocal(),
    decisionNote: '${j['decisionNote'] ?? ''}',
  );
  Map<String, dynamic> toJson() => {
    'id': id, 'crewId': crewId, 'name': name, 'role': role, 'busId': busId, 'type': type, 'from': from, 'to': to, 'days': days,
    'reason': reason, 'status': status, if (appliedAt != null) 'appliedAt': appliedAt!.toUtc().toIso8601String(),
    if (decidedBy != null) 'decidedBy': decidedBy, if (decidedAt != null) 'decidedAt': decidedAt!.toUtc().toIso8601String(),
    if (decisionNote.isNotEmpty) 'decisionNote': decisionNote,
  };

  @override
  List<Object?> get props => [id, crewId, type, from, to, reason, name, role, busId, status, appliedAt, decidedBy, decidedAt, decisionNote];
}
