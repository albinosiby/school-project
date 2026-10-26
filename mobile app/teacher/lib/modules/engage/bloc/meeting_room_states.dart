import 'package:equatable/equatable.dart';
import '../models/meeting_models.dart';
import 'engage_notice.dart';

class MeetingRoomState extends Equatable implements NoticeState {
  const MeetingRoomState({this.status = EngageStatus.initial, this.meetingId = '', this.meeting, this.participants = const [], this.waiting = const [], this.chat = const [], this.notice, this.error});
  final EngageStatus status;
  final String meetingId;
  final Meeting? meeting;
  final List<Participant> participants;
  final List<WaitingGuest> waiting;
  final List<ChatMessage> chat;
  @override
  final Notice? notice;
  final String? error;

  /// Participants plus the host.
  int get headcount => participants.length + 1;
  List<ChatMessage> get pinned => chat.where((c) => c.pinned).toList();

  /// The active speaker (or the first participant).
  Participant? get speaker => participants.where((p) => p.speaking).firstOrNull ?? participants.firstOrNull;

  MeetingRoomState copyWith({EngageStatus? status, String? meetingId, Meeting? meeting, List<Participant>? participants, List<WaitingGuest>? waiting, List<ChatMessage>? chat, Notice? notice, String? error}) =>
      MeetingRoomState(
        status: status ?? this.status, meetingId: meetingId ?? this.meetingId, meeting: meeting ?? this.meeting, participants: participants ?? this.participants,
        waiting: waiting ?? this.waiting, chat: chat ?? this.chat, notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, meetingId, meeting, participants, waiting, chat, notice, error];
}
