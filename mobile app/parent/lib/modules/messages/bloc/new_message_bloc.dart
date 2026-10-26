import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../repositories/message_repository_interface.dart';
import 'new_message_events.dart';
import 'new_message_states.dart';

export 'new_message_events.dart';
export 'new_message_states.dart';

/// New Message (Figma 4.2): recipients, validation, send (creates a thread) and drafts.
class NewMessageBloc extends Bloc<NewMessageEvent, NewMessageState> {
  NewMessageBloc(this._repo) : super(const NewMessageState()) {
    on<NewMessageStarted>((event, emit) async {
      final draft = event.draftId == null
          ? null
          : await _repo.draft(event.draftId!);
      emit(
        NewMessageState(
          draft: draft,
          contactId: event.contactId ?? draft?.contactId,
        ),
      );
      await emit.forEach(
        _repo.watchContacts(event.childId),
        onData: (c) => state.copyWith(status: LoadStatus.loaded, contacts: c),
        onError: (e, _) => state.contacts.isNotEmpty
            ? state
            : state.copyWith(status: LoadStatus.error, error: errorMessage(e)),
      );
    }, transformer: restartable());

    on<NewMessageSubmitted>((event, emit) async {
      if (state.submit == SubmitStatus.sending) return;
      final invalid = event.request.error;
      if (invalid != null) {
        emit(state.copyWith(submit: SubmitStatus.failed, error: invalid));
        return;
      }
      emit(state.copyWith(submit: SubmitStatus.sending, clearError: true));
      try {
        final t = await _repo.startThread(event.request);
        emit(state.copyWith(submit: SubmitStatus.sent, thread: t));
      } catch (e) {
        emit(
          state.copyWith(submit: SubmitStatus.failed, error: errorMessage(e)),
        );
      }
    }, transformer: droppable());

    on<NewMessageDraftSaved>((event, emit) async {
      final d = await _repo.saveDraft(event.draft);
      emit(state.copyWith(submit: SubmitStatus.draftSaved, draft: d));
    });
  }

  final IMessageRepository _repo;
}
