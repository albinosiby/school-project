import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart' show IconData, Icons;
import '../../../utils/helpers/date_helper.dart';

enum LeaveStatus { pending, approved, rejected }

extension LeaveStatusX on LeaveStatus {
  String get label => switch (this) {
    LeaveStatus.pending => 'Pending',
    LeaveStatus.approved => 'Approved',
    LeaveStatus.rejected => 'Rejected',
  };
}

/// Leave category (Figma "Medical | Family Event | Other"). Medical uses the medical allowance,
/// the others the casual allowance.
enum LeaveType { medical, familyEvent, other }

enum LeavePool { medical, casual }

extension LeaveTypeX on LeaveType {
  String get label => switch (this) {
    LeaveType.medical => 'Medical',
    LeaveType.familyEvent => 'Family Event',
    LeaveType.other => 'Other',
  };
  IconData get icon => switch (this) {
    LeaveType.medical => Icons.medical_services_outlined,
    LeaveType.familyEvent => Icons.groups_outlined,
    LeaveType.other => Icons.more_horiz_rounded,
  };
  LeavePool get pool =>
      this == LeaveType.medical ? LeavePool.medical : LeavePool.casual;
}

extension LeavePoolX on LeavePool {
  String get label => switch (this) {
    LeavePool.medical => 'medical',
    LeavePool.casual => 'casual',
  };
}

/// School days (Mon-Fri) from [from] to [to], both included.
int workingDaysBetween(DateTime from, DateTime to) {
  var d = dateOnly(from);
  final end = dateOnly(to);
  var n = 0;
  while (!d.isAfter(end)) {
    if (d.weekday <= DateTime.friday) n++;
    d = DateTime(d.year, d.month, d.day + 1);
  }
  return n;
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
    this.type = LeaveType.other,
    this.attachment,
    this.reviewer,
  });
  final String id, childId, reason;
  final DateTime from, to, appliedOn;
  final LeaveStatus status;
  final String? reviewerNote;
  final LeaveType type;

  /// Name of the attached slip / prescription, if any.
  final String? attachment;

  /// Teacher who reviewed it.
  final String? reviewer;

  int get days => to.difference(from).inDays + 1;
  int get workingDays => workingDaysBetween(from, to);

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
    type,
    attachment,
    reviewer,
  ];
}

/// Everything the Apply Leave screen needs: history, allowances and the attendance base for the
/// "CBSE Attendance Impact" projection.
class LeaveOverview extends Equatable {
  const LeaveOverview({
    required this.history,
    required this.attendedDays,
    required this.workingDays,
    this.medicalAllowance = 5,
    this.casualAllowance = 5,
    this.minAttendance = 75,
  });
  final List<LeaveRequest> history;

  /// Attended school days of the term (late = 1, half day = 0.5) and the counted working days.
  final double attendedDays;
  final int workingDays;
  final int medicalAllowance, casualAllowance;

  /// CBSE minimum attendance, in percent.
  final double minAttendance;

  double get currentPct =>
      workingDays == 0 ? 100 : attendedDays / workingDays * 100;

  /// Attendance after [leaveDays] more school days of leave.
  double projectedPct(int leaveDays) => workingDays + leaveDays == 0
      ? 100
      : attendedDays / (workingDays + leaveDays) * 100;

  int allowance(LeavePool p) =>
      p == LeavePool.medical ? medicalAllowance : casualAllowance;

  /// Working days already taken (approved or pending) from the pool.
  int used(LeavePool p) => history
      .where((r) => r.status != LeaveStatus.rejected && r.type.pool == p)
      .fold(0, (s, r) => s + r.workingDays);

  int left(LeavePool p) => (allowance(p) - used(p)).clamp(0, allowance(p));

  LeaveRequest? get latest => history.isEmpty ? null : history.first;

  @override
  List<Object?> get props => [
    history,
    attendedDays,
    workingDays,
    medicalAllowance,
    casualAllowance,
    minAttendance,
  ];
}
