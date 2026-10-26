import 'package:equatable/equatable.dart';
import '../models/duty_models.dart';

sealed class DutiesEvent extends Equatable {
  const DutiesEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or reload) duties, swap requests, grading deadlines and the syllabus log state.
class DutiesLoadRequested extends DutiesEvent {
  const DutiesLoadRequested();
}

/// Marks a duty completed, or reopens it.
class DutyDoneToggled extends DutiesEvent {
  const DutyDoneToggled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Joins a staff meeting stream (simulated).
class DutyStreamJoined extends DutiesEvent {
  const DutyStreamJoined(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class DutySwapRequested extends DutiesEvent {
  const DutySwapRequested(this.request);
  final SwapRequest request;
  @override
  List<Object?> get props => [request];
}

class DutySwapCancelled extends DutiesEvent {
  const DutySwapCancelled(this.swapId);
  final String swapId;
  @override
  List<Object?> get props => [swapId];
}
