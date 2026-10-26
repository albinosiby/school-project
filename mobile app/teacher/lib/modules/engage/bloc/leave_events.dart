import 'package:equatable/equatable.dart';

sealed class LeaveEvent extends Equatable {
  const LeaveEvent();
  @override
  List<Object?> get props => [];
}

class LeaveLoadRequested extends LeaveEvent {
  const LeaveLoadRequested();
}

class MyLeaveCancelled extends LeaveEvent {
  const MyLeaveCancelled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Approve or deny a student's leave request ([note] is the optional denial reason).
class StudentLeaveDecided extends LeaveEvent {
  const StudentLeaveDecided(this.id, {required this.approve, this.note = ''});
  final String id, note;
  final bool approve;
  @override
  List<Object?> get props => [id, approve, note];
}
