import 'package:equatable/equatable.dart';
import '../models/leave_models.dart';

sealed class LeaveEvent extends Equatable {
  const LeaveEvent();
  @override
  List<Object?> get props => [];
}

class LeaveLoadRequested extends LeaveEvent {
  const LeaveLoadRequested();
}

class LeaveApplied extends LeaveEvent {
  const LeaveApplied(this.application);
  final LeaveApplication application;
  @override
  List<Object?> get props => [application];
}
