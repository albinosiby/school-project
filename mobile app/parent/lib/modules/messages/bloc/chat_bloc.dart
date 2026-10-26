import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../repositories/message_repository_interface.dart';
import 'chat_events.dart';
import 'chat_states.dart';

export 'chat_events.dart';
export 'chat_states.dart';

/// One conversation with a teacher.
class ChatBloc extends Bloc<ChatEvent, ChatState> {
  ChatBloc(this._repo) : super(const ChatState()) {
    on<OpenChat>((event, emit) async {
      emit(ChatState(threadId: event.threadId));
      await emit.forEach(
        _repo.watchMessages(event.threadId),
        onData: (m) => ChatState(
          status: LoadStatus.loaded,
          messages: m,
          threadId: event.threadId,
        ),
        onError: (e, _) => state.messages.isNotEmpty
            ? state
            : ChatState(
                status: LoadStatus.error,
                error: errorMessage(e),
                threadId: event.threadId,
              ),
      );
    }, transformer: restartable());
    on<SendChatMessage>((event, emit) async {
      final id = state.threadId;
      final text = event.text.trim();
      if (id == null || text.isEmpty) return;
      emit(state.copyWith(sending: true, clearError: true));
      try {
        await _repo.send(id, text);
        emit(state.copyWith(sending: false));
      } catch (e) {
        emit(state.copyWith(sending: false, error: errorMessage(e)));
      }
    }, transformer: sequential());
  }

  final IMessageRepository _repo;
}
