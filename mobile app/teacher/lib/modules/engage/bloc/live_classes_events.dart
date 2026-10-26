import 'package:equatable/equatable.dart';
import '../models/live_class_models.dart';

sealed class LiveClassesEvent extends Equatable {
  const LiveClassesEvent();
  @override
  List<Object?> get props => [];
}

class LiveClassesLoadRequested extends LiveClassesEvent {
  const LiveClassesLoadRequested();
}

/// Create or update a session from the schedule form (as a draft or scheduled).
class LiveSessionSaved extends LiveClassesEvent {
  const LiveSessionSaved(this.session, {this.draft = false});
  final LiveSession session;
  final bool draft;
  @override
  List<Object?> get props => [session, draft];
}

/// Cancel an upcoming session or delete a past recording; [message] is shown afterwards.
class LiveSessionDeleted extends LiveClassesEvent {
  const LiveSessionDeleted(this.id, {required this.message});
  final String id, message;
  @override
  List<Object?> get props => [id, message];
}

/// The host joined from the lobby: the session goes live.
class LiveSessionStarted extends LiveClassesEvent {
  const LiveSessionStarted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// The host ended the class for everyone: the session moves to past recordings.
class LiveSessionEnded extends LiveClassesEvent {
  const LiveSessionEnded(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// "Create Google Meet" in the schedule form: a new Meet room on the teacher's Google account.
class LiveMeetCreateRequested extends LiveClassesEvent {
  const LiveMeetCreateRequested();
}

/// Join was tapped for a Google Meet session (the link is opened by the screen); records it.
class LiveSessionJoinOpened extends LiveClassesEvent {
  const LiveSessionJoinOpened(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}
