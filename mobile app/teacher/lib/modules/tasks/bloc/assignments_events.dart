import 'package:equatable/equatable.dart';

sealed class AssignmentsEvent extends Equatable {
  const AssignmentsEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or reload) every assignment of the teacher with classes and rosters.
class AssignmentsLoadRequested extends AssignmentsEvent {
  const AssignmentsLoadRequested();
}
