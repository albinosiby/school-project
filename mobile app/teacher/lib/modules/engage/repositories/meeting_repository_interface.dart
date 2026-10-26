import '../models/meeting_models.dart';

/// Parent-teacher meetings and their (simulated) meeting room: participants, waiting room and live chat.
abstract class IMeetingRepository {
  Future<List<Meeting>> getAll();
  Future<Meeting?> get(String id);

  /// Creates the meeting when [meeting].id is empty, otherwise updates it (RSVP, target, file and summary are kept).
  Future<Meeting> save(Meeting meeting);
  Future<void> delete(String id);
  Future<void> addTopic(String id, AgendaTopic topic);
  Future<void> markStarted(String id);
  Future<void> complete(String id, {required String summary});

  /// Creates the participant / waiting / chat rows the first time a meeting room is opened.
  Future<void> ensureRoom(String meetingId);
  Future<List<Participant>> getParticipants(String meetingId);
  Future<List<WaitingGuest>> getWaiting(String meetingId);
  Future<List<ChatMessage>> getChat(String meetingId);
  Future<void> admit(String guestId);
  Future<void> admitAll(String meetingId);
  Future<void> deny(String guestId);
  Future<void> setMuted(String participantId, bool muted);
  Future<void> muteAll(String meetingId);
  Future<void> sendChat(ChatMessage message);
  Future<void> togglePin(String chatId);
  Stream<void> watch();
}
