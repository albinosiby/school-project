import 'package:equatable/equatable.dart';
import '../models/meeting_models.dart';

sealed class MeetingRoomEvent extends Equatable {
  const MeetingRoomEvent();
  @override
  List<Object?> get props => [];
}

/// Opens (and on later calls reloads) the room of [meetingId], creating its participant rows the first time.
class MeetingRoomLoadRequested extends MeetingRoomEvent {
  const MeetingRoomLoadRequested(this.meetingId);
  final String meetingId;
  @override
  List<Object?> get props => [meetingId];
}

class GuestAdmitted extends MeetingRoomEvent {
  const GuestAdmitted(this.guestId);
  final String guestId;
  @override
  List<Object?> get props => [guestId];
}

class AllGuestsAdmitted extends MeetingRoomEvent {
  const AllGuestsAdmitted();
}

class GuestDenied extends MeetingRoomEvent {
  const GuestDenied(this.guestId);
  final String guestId;
  @override
  List<Object?> get props => [guestId];
}

class ParticipantMuteToggled extends MeetingRoomEvent {
  const ParticipantMuteToggled(this.participantId);
  final String participantId;
  @override
  List<Object?> get props => [participantId];
}

class AllParticipantsMuted extends MeetingRoomEvent {
  const AllParticipantsMuted();
}

class ChatMessageSent extends MeetingRoomEvent {
  const ChatMessageSent(this.text);
  final String text;
  @override
  List<Object?> get props => [text];
}

class ChatPinToggled extends MeetingRoomEvent {
  const ChatPinToggled(this.chatId);
  final String chatId;
  @override
  List<Object?> get props => [chatId];
}

class AgendaTopicAdded extends MeetingRoomEvent {
  const AgendaTopicAdded(this.topic);
  final AgendaTopic topic;
  @override
  List<Object?> get props => [topic];
}

/// The host joined from the lobby.
class MeetingJoined extends MeetingRoomEvent {
  const MeetingJoined();
}

/// The host left ([endForAll] false) or ended the meeting for everyone after [seconds].
class MeetingLeft extends MeetingRoomEvent {
  const MeetingLeft({required this.endForAll, this.seconds = 0});
  final bool endForAll;
  final int seconds;
  @override
  List<Object?> get props => [endForAll, seconds];
}
