import 'package:equatable/equatable.dart';

sealed class SlipsEvent extends Equatable {
  const SlipsEvent();
  @override
  List<Object?> get props => [];
}

class SlipsLoadRequested extends SlipsEvent {
  const SlipsLoadRequested();
}

/// Approve or reject a medical slip (reject needs a [reason]).
class MedicalSlipDecided extends SlipsEvent {
  const MedicalSlipDecided(this.id, {required this.approved, this.reason});
  final String id;
  final bool approved;
  final String? reason;
  @override
  List<Object?> get props => [id, approved, reason];
}

/// Approve / reject / ask clarification for / reopen ('Pending') a student leave slip.
class LeaveSlipStatusChanged extends SlipsEvent {
  const LeaveSlipStatusChanged(this.id, this.status, {this.note});
  final String id, status;
  final String? note;
  @override
  List<Object?> get props => [id, status, note];
}
