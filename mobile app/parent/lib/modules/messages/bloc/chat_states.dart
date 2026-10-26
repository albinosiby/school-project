import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/message_models.dart';

class ChatState extends Equatable {
  const ChatState({
    this.status = LoadStatus.loading,
    this.messages = const [],
    this.sending = false,
    this.error,
    this.threadId,
  });
  final LoadStatus status;
  final List<ChatMessage> messages;
  final bool sending;
  final String? error, threadId;

  ChatState copyWith({
    LoadStatus? status,
    List<ChatMessage>? messages,
    bool? sending,
    String? error,
    bool clearError = false,
  }) => ChatState(
    status: status ?? this.status,
    messages: messages ?? this.messages,
    sending: sending ?? this.sending,
    error: clearError ? null : (error ?? this.error),
    threadId: threadId,
  );

  @override
  List<Object?> get props => [status, messages, sending, error, threadId];
}
