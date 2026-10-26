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

  /// Appends my message to an existing thread.
  Future<void> reply(String threadId, ThreadMessage message);

  /// Sends [text] (and [attach]) to every recipient id, appending to the existing thread or starting a new one.
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
