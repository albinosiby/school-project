import 'package:equatable/equatable.dart';
import '../models/meeting_models.dart';

sealed class MeetingsEvent extends Equatable {
  const MeetingsEvent();
  @override
  List<Object?> get props => [];
}

class MeetingsLoadRequested extends MeetingsEvent {
  const MeetingsLoadRequested();
}

/// Create or update a meeting from the schedule form (as a draft or scheduled).
class MeetingSaved extends MeetingsEvent {
  const MeetingSaved(this.meeting, {this.draft = false});
  final Meeting meeting;
  final bool draft;
  @override
  List<Object?> get props => [meeting, draft];
}

class MeetingDeleted extends MeetingsEvent {
  const MeetingDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
