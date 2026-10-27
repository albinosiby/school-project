import 'package:equatable/equatable.dart';
import '../models/message_models.dart';

sealed class ChatEvent extends Equatable {
  const ChatEvent();
  @override
  List<Object?> get props => [];
}

/// Load a conversation (and mark it read).
class OpenChat extends ChatEvent {
  const OpenChat(this.threadId);
  final String threadId;
  @override
  List<Object?> get props => [threadId];
}

class SendChatMessage extends ChatEvent {
  const SendChatMessage(this.text, {this.attachments = const []});
  final String text;
  final List<MessageAttachment> attachments;
  @override
  List<Object?> get props => [text, attachments];
}
