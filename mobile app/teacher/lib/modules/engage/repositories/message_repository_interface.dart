import '../models/attachment_models.dart';
import '../models/message_models.dart';

/// Conversations (`ms_messages`, integer `unread`), contacts and drafts.
abstract class IMessageRepository {
  Future<List<MessageThread>> getThreads();
  Future<MessageThread?> getThread(String id);
  Future<void> markRead(String id);
  Future<void> markUnread(String id);
  Future<void> setPinned(String id, bool pinned);
  Future<void> deleteThread(String id);

  /// Appends my message to a thread. [threadId] may also be a recipient id (`g_<studentId>` or a contact id):
  /// the conversation is then started with this message. Recipients that are not [Recipient.available] are skipped.
  Future<void> reply(String threadId, ThreadMessage message);

  /// Meetings scheduled from chats (`ms_meetings`), newest first; [threadId] narrows to one conversation.
  Future<List<ChatMeeting>> getMeetings({String? threadId});
  /// Creates the meeting and posts its card into the thread.
  Future<ChatMeeting> scheduleMeeting(String threadId, ChatMeeting meeting);
  /// Moves the meeting to a new date/time/link and posts an update card.
  Future<void> rescheduleMeeting(String id, ChatMeeting next);
  /// Marks the meeting cancelled and posts a cancellation card.
  Future<void> cancelMeeting(String id);

  /// Sends [text] (and [attach]) to every recipient id, appending to the existing thread or starting a new one.
  /// Recipients that are not [Recipient.available] (guardian without a parent app login) are skipped.
  Future<void> send({required List<String> to, required String text, String subject = '', List<FileRef> attach = const []});

  /// Saved contacts followed by every student and guardian (`g_<studentId>`).
  Future<List<Recipient>> getRecipients();
  Future<Recipient?> resolveRecipient(String id);

  Future<List<MessageDraft>> getDrafts();
  Future<MessageDraft?> getDraft(String id);

  /// Creates the draft when [draft].id is empty (or no longer exists), otherwise updates it.
  Future<MessageDraft> saveDraft(MessageDraft draft);
  Future<void> deleteDraft(String id);
  Future<void> deleteAllDrafts();
  Stream<void> watch();
}
