import '../models/message_models.dart';

/// Messages with teachers and school offices. Reads are cache-first streams (cached value, then fresh);
/// writes push fresh data through the same streams.
abstract class IMessageRepository {
  /// Threads (pinned first, newest first) and drafts of [childId].
  Stream<MessagesOverview> watchOverview(String childId);

  /// Number of conversations with unread messages (tab badge, home).
  Stream<int> watchUnreadCount(String childId);

  /// One thread with its messages (oldest first).
  Stream<Conversation> watchConversation(String threadId);

  /// Teachers and offices the guardian can write to about [childId].
  Stream<List<MessageContact>> watchContacts(String childId);

  Future<void> send(
    String threadId,
    String text, {
    List<MessageAttachment> attachments = const [],
  });
  Future<void> markRead(String threadId);
  Future<void> markAllRead(String childId);
  Future<void> setPinned(String threadId, bool pinned);

  /// Creates a thread from the New Message form (deletes the draft it came from) and returns it.
  Future<MessageThread> startThread(NewMessageRequest request);

  Future<MessageDraft?> draft(String draftId);
  Future<MessageDraft> saveDraft(MessageDraft draft);
  Future<void> deleteDraft(String draftId);
}
