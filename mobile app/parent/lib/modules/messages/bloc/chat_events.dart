import 'package:equatable/equatable.dart';

sealed class ChatEvent extends Equatable {
  const ChatEvent();
  @override
  List<Object?> get props => [];
}

class OpenChat extends ChatEvent {
  const OpenChat(this.threadId);
  final String threadId;
  @override
  List<Object?> get props => [threadId];
}

class SendChatMessage extends ChatEvent {
  const SendChatMessage(this.text);
  final String text;
  @override
  List<Object?> get props => [text];
}
