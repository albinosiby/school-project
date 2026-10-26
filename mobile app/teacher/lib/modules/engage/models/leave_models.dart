import 'package:equatable/equatable.dart';
import 'attachment_models.dart';

/// One of the teacher's own leaves — collection `lm_my`. [status] is Approved / Pending / Completed / Rejected / Cancelled.
class MyLeave extends Equatable {
  const MyLeave({required this.id, required this.type, required this.from, required this.to, required this.days, this.timeText = '', this.note = '', required this.status, this.reason = '', this.attachment, this.sanctionedBy = '', this.handover = '', this.handoverNote = ''});
  final String id, type, from, to, timeText, note, status, reason, sanctionedBy, handover, handoverNote;
  final double days;
  final FileRef? attachment;

  /// Days counted against the balance.
  bool get countsAgainstBalance => status == 'Approved' || status == 'Completed' || status == 'Pending';

  factory MyLeave.fromJson(Map<String, dynamic> j) => MyLeave(
        id: '${j['id'] ?? ''}', type: '${j['type'] ?? ''}', from: '${j['from'] ?? ''}', to: '${j['to'] ?? ''}', days: (j['days'] as num?)?.toDouble() ?? 0,
        timeText: '${j['timeText'] ?? ''}', note: '${j['note'] ?? ''}', status: '${j['status'] ?? ''}', reason: '${j['reason'] ?? ''}', attachment: FileRef.maybe(j['attachment']),
        sanctionedBy: '${j['sanctionedBy'] ?? ''}', handover: '${j['handover'] ?? ''}', handoverNote: '${j['handoverNote'] ?? ''}',
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'type': type, 'from': from, 'to': to, 'days': days, 'timeText': timeText, 'note': note, 'status': status, 'reason': reason,
        'attachment': attachment?.toJson(), 'sanctionedBy': sanctionedBy, 'handover': handover, 'handoverNote': handoverNote,
      };
  MyLeave copyWith({String? status}) => MyLeave.fromJson({...toJson(), 'status': ?status});

  @override
  List<Object?> get props => [id, type, from, to, days, timeText, note, status, reason, attachment, sanctionedBy, handover, handoverNote];
}

/// Yearly allowance per leave type — collection `lm_balance`.
class LeaveBalance extends Equatable {
  const LeaveBalance({required this.id, required this.type, required this.total});
  final String id, type;
  final double total;
  factory LeaveBalance.fromJson(Map<String, dynamic> j) => LeaveBalance(id: '${j['id'] ?? ''}', type: '${j['type'] ?? ''}', total: (j['total'] as num?)?.toDouble() ?? 0);
  Map<String, dynamic> toJson() => {'id': id, 'type': type, 'total': total};
  LeaveBalance copyWith({double? total}) => LeaveBalance(id: id, type: type, total: total ?? this.total);
  @override
  List<Object?> get props => [id, type, total];
}

enum StudentLeaveStatus { pending, approved, rejected }

/// A leave request from a student's parent — collection `lm_student`. [cat] is medical / leave / duty.
class StudentLeave extends Equatable {
  const StudentLeave({
    required this.id, required this.name, required this.roll, required this.classId, required this.type, required this.cat, required this.days, required this.daysLabel,
    required this.dateText, required this.reason, this.att, this.by = '', this.ago = '', this.attend = 0, this.status = StudentLeaveStatus.pending, this.processedBy = '', this.processedAt = 0, this.note = '',
  });
  final String id, name, classId, type, cat, daysLabel, dateText, reason, by, ago, processedBy, note;
  final int roll, days, processedAt;
  final double attend;
  final FileRef? att;
  final StudentLeaveStatus status;

  bool get pending => status == StudentLeaveStatus.pending;
  bool get medical => cat == 'medical';

  factory StudentLeave.fromJson(Map<String, dynamic> j) => StudentLeave(
        id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', roll: (j['roll'] as num?)?.toInt() ?? 0, classId: '${j['classId'] ?? ''}', type: '${j['type'] ?? ''}',
        cat: '${j['cat'] ?? ''}', days: (j['days'] as num?)?.toInt() ?? 0, daysLabel: '${j['daysLabel'] ?? ''}', dateText: '${j['dateText'] ?? ''}',
        reason: '${j['reason'] ?? ''}', att: FileRef.maybe(j['att']), by: '${j['by'] ?? ''}', ago: '${j['ago'] ?? ''}', attend: (j['attend'] as num?)?.toDouble() ?? 0,
        status: StudentLeaveStatus.values.asNameMap()[j['status']] ?? StudentLeaveStatus.pending, processedBy: '${j['processedBy'] ?? ''}',
        processedAt: (j['processedAt'] as num?)?.toInt() ?? 0, note: '${j['note'] ?? ''}',
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'name': name, 'roll': roll, 'classId': classId, 'type': type, 'cat': cat, 'days': days, 'daysLabel': daysLabel, 'dateText': dateText, 'reason': reason,
        'att': att?.toJson(), 'by': by, 'ago': ago, 'attend': attend, 'status': status.name, 'processedBy': processedBy, 'processedAt': processedAt, 'note': note,
      };
  StudentLeave copyWith({StudentLeaveStatus? status, String? processedBy, int? processedAt, String? note}) =>
      StudentLeave.fromJson({...toJson(), 'status': ?status?.name, 'processedBy': ?processedBy, 'processedAt': ?processedAt, 'note': ?note});

  @override
  List<Object?> get props => [id, name, roll, classId, type, cat, days, daysLabel, dateText, reason, att, by, ago, attend, status, processedBy, processedAt, note];
}
