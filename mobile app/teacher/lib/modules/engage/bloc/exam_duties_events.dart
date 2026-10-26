import 'package:equatable/equatable.dart';

sealed class ExamDutiesEvent extends Equatable {
  const ExamDutiesEvent();
  @override
  List<Object?> get props => [];
}

class ExamDutiesLoadRequested extends ExamDutiesEvent {
  const ExamDutiesLoadRequested();
}

/// Tick / untick protocol checklist item [index] of duty [id].
class ChecklistItemToggled extends ExamDutiesEvent {
  const ChecklistItemToggled(this.id, this.index, {required this.checked});
  final String id;
  final int index;
  final bool checked;
  @override
  List<Object?> get props => [id, index, checked];
}

class SwapRequested extends ExamDutiesEvent {
  const SwapRequested(this.id, {required this.withWhom, required this.reason});
  final String id, withWhom, reason;
  @override
  List<Object?> get props => [id, withWhom, reason];
}

class SwapCancelled extends ExamDutiesEvent {
  const SwapCancelled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
