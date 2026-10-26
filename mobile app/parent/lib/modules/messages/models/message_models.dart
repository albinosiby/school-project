import 'package:equatable/equatable.dart';

class MessageThread extends Equatable {
  const MessageThread({
    required this.id,
    required this.childId,
    required this.teacher,
    required this.role,
    required this.lastMessage,
    required this.lastAt,
    this.unread = 0,
  });
  final String id, childId, teacher, role, lastMessage;
  final DateTime lastAt;
  final int unread;

  @override
  List<Object?> get props => [
    id,
    childId,
    teacher,
    role,
    lastMessage,
    lastAt,
    unread,
  ];
}

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.threadId,
    required this.fromParent,
    required this.text,
    required this.at,
  });
  final String id, threadId, text;
  final bool fromParent;
  final DateTime at;

  @override
  List<Object?> get props => [id, threadId, fromParent, text, at];
}
