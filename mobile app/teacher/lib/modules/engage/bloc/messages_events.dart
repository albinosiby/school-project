import 'package:equatable/equatable.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';

sealed class MessagesEvent extends Equatable {
  const MessagesEvent();
  @override
  List<Object?> get props => [];
}

class MessagesLoadRequested extends MessagesEvent {
  const MessagesLoadRequested();
}

/// A conversation was opened: its unread count is cleared.
class ThreadOpened extends MessagesEvent {
  const ThreadOpened(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class ThreadMarkedUnread extends MessagesEvent {
  const ThreadMarkedUnread(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class ThreadPinToggled extends MessagesEvent {
  const ThreadPinToggled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class ThreadDeleted extends MessagesEvent {
  const ThreadDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Reply in a conversation with [text] (quick replies included).
class ReplySent extends MessagesEvent {
  const ReplySent(this.threadId, this.text);
  final String threadId, text;
  @override
  List<Object?> get props => [threadId, text];
}

/// Send [files] in a conversation, one message each.
class FilesSent extends MessagesEvent {
  const FilesSent(this.threadId, this.files);
  final String threadId;
  final List<FileRef> files;
  @override
  List<Object?> get props => [threadId, files];
}

class CallRequested extends MessagesEvent {
  const CallRequested(this.threadId, this.slot);
  final String threadId, slot;
  @override
  List<Object?> get props => [threadId, slot];
}

/// Compose: send to every recipient id; the draft [draftId] (if any) is removed.
class MessageSent extends MessagesEvent {
  const MessageSent({required this.to, required this.text, this.subject = '', this.attach = const [], this.draftId});
  final List<String> to;
  final String text, subject;
  final List<FileRef> attach;
  final String? draftId;
  @override
  List<Object?> get props => [to, text, subject, attach, draftId];
}

class DraftSaved extends MessagesEvent {
  const DraftSaved(this.draft);
  final MessageDraft draft;
  @override
  List<Object?> get props => [draft];
}

class DraftDeleted extends MessagesEvent {
  const DraftDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class AllDraftsDeleted extends MessagesEvent {
  const AllDraftsDeleted();
}
