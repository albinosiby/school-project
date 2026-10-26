import 'package:equatable/equatable.dart';

sealed class OverviewEvent extends Equatable {
  const OverviewEvent();
  @override
  List<Object?> get props => [];
}

class OverviewLoadRequested extends OverviewEvent {
  const OverviewLoadRequested();
}

/// Quick-approve a pending student leave slip from the overview list.
class OverviewLeaveSlipApproved extends OverviewEvent {
  const OverviewLeaveSlipApproved(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
