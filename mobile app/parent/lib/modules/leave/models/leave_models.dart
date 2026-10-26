import 'package:equatable/equatable.dart';

enum LeaveStatus { pending, approved, rejected }

extension LeaveStatusX on LeaveStatus {
  String get label => switch (this) {
    LeaveStatus.pending => 'Pending',
    LeaveStatus.approved => 'Approved',
    LeaveStatus.rejected => 'Rejected',
  };
}

class LeaveRequest extends Equatable {
  const LeaveRequest({
    required this.id,
    required this.childId,
    required this.from,
    required this.to,
    required this.reason,
    required this.appliedOn,
    this.status = LeaveStatus.pending,
    this.reviewerNote,
  });
  final String id, childId, reason;
  final DateTime from, to, appliedOn;
  final LeaveStatus status;
  final String? reviewerNote;

  int get days => to.difference(from).inDays + 1;

  @override
  List<Object?> get props => [
    id,
    childId,
    reason,
    from,
    to,
    appliedOn,
    status,
    reviewerNote,
  ];
}
