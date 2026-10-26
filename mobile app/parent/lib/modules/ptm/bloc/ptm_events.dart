import 'package:equatable/equatable.dart';
import '../models/ptm_models.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Writes on meetings (handled by [PtmActionBloc]).
sealed class PtmActionEvent extends Equatable {
  const PtmActionEvent(this.childId);
  final String childId;
  @override
  List<Object?> get props => [childId];
}

class BookPtm extends PtmActionEvent {
  const BookPtm({
    required String childId,
    this.teacherId,
    this.slotId,
    this.mode = MeetingMode.inPerson,
    this.agenda = '',
  }) : super(childId);
  final String? teacherId, slotId;
  final MeetingMode mode;
  final String agenda;
  @override
  List<Object?> get props => [childId, teacherId, slotId, mode, agenda];
}

class ReschedulePtm extends PtmActionEvent {
  const ReschedulePtm({
    required String childId,
    required this.meetingId,
    this.slotId,
  }) : super(childId);
  final String meetingId;
  final String? slotId;
  @override
  List<Object?> get props => [childId, meetingId, slotId];
}

class CancelPtm extends PtmActionEvent {
  const CancelPtm({required String childId, required this.meetingId})
    : super(childId);
  final String meetingId;
  @override
  List<Object?> get props => [childId, meetingId];
}

class JoinPtm extends PtmActionEvent {
  const JoinPtm({required String childId, required this.meetingId})
    : super(childId);
  final String meetingId;
  @override
  List<Object?> get props => [childId, meetingId];
}

/// Clears a finished action (after the screen showed its result).
class ResetPtmAction extends PtmActionEvent {
  const ResetPtmAction() : super('');
}
