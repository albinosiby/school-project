import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/message_models.dart';

export '../../../core/bloc/child_data_bloc.dart' show LoadStatus;

class ChatState extends Equatable {
  const ChatState({
    this.status = LoadStatus.loading,
    this.conversation,
    this.sending = false,
    this.error,
    this.threadId,
  });
  final LoadStatus status;
  final Conversation? conversation;
  final bool sending;

  /// Load error (status == error) or the last failed send.
  final String? error;
  final String? threadId;

  MessageThread? get thread => conversation?.thread;
  List<ChatMessage> get messages => conversation?.messages ?? const [];

  ChatState copyWith({
    LoadStatus? status,
    Conversation? conversation,
    bool? sending,
    String? error,
    bool clearError = false,
  }) => ChatState(
    status: status ?? this.status,
    conversation: conversation ?? this.conversation,
    sending: sending ?? this.sending,
    error: clearError ? null : (error ?? this.error),
    threadId: threadId,
  );

  @override
  List<Object?> get props => [status, conversation, sending, error, threadId];
}
