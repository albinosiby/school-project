import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/message_models.dart';
import '../repositories/message_repository_interface.dart';
import 'engage_notice.dart';
import 'messages_events.dart';
import 'messages_states.dart';

/// Inbox, conversation view, compose and drafts.
class MessagesBloc extends Bloc<MessagesEvent, MessagesState> {
  MessagesBloc(this._repo) : super(const MessagesState()) {
    on<MessagesLoadRequested>(_onLoad);
    on<ThreadOpened>((e, _) => _repo.markRead(e.id));
    on<ThreadMarkedUnread>(_onUnread);
    on<ThreadPinToggled>(_onPin);
    on<ThreadDeleted>(_onDeleteThread);
    on<ReplySent>(_onReply);
    on<FilesSent>(_onFiles);
    on<CallRequested>(_onCall);
    on<MessageSent>(_onSend);
    on<DraftSaved>(_onDraft);
    on<DraftDeleted>(_onDraftDeleted);
    on<AllDraftsDeleted>(_onAllDrafts);
    _sub = _repo.watch().listen((_) => add(const MessagesLoadRequested()));
  }

  final IMessageRepository _repo;
  late final StreamSubscription<void> _sub;

  Notice _next(String m, {bool pop = false}) => Notice.next(state.notice, m, pop: pop);

  Future<void> _onLoad(MessagesLoadRequested e, Emitter<MessagesState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(
        status: EngageStatus.loaded, threads: await _repo.getThreads(), drafts: await _repo.getDrafts(), recipients: await _repo.getRecipients(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onUnread(ThreadMarkedUnread e, Emitter<MessagesState> emit) async {
    await _repo.markUnread(e.id);
    emit(state.copyWith(notice: _next('Marked as unread', pop: true)));
  }

  Future<void> _onPin(ThreadPinToggled e, Emitter<MessagesState> emit) async {
    final t = state.thread(e.id) ?? await _repo.getThread(e.id);
    if (t == null) return;
    await _repo.setPinned(e.id, !t.pinned);
    emit(state.copyWith(notice: _next(t.pinned ? 'Unpinned' : 'Pinned to top')));
  }

  Future<void> _onDeleteThread(ThreadDeleted e, Emitter<MessagesState> emit) async {
    await _repo.deleteThread(e.id);
    emit(state.copyWith(notice: _next('Conversation deleted', pop: true)));
  }

  Future<void> _onReply(ReplySent e, Emitter<MessagesState> emit) async {
    final text = e.text.trim();
    if (text.isEmpty) return;
    await _repo.reply(e.threadId, ThreadMessage(text: text, ts: nowIso()));
  }

  Future<void> _onFiles(FilesSent e, Emitter<MessagesState> emit) async {
    if (e.files.isEmpty) return;
    for (final f in e.files) {
      await _repo.reply(e.threadId, ThreadMessage(ts: nowIso(), attach: f));
    }
    emit(state.copyWith(notice: _next('${e.files.length} file${e.files.length == 1 ? '' : 's'} sent')));
  }

  Future<void> _onCall(CallRequested e, Emitter<MessagesState> emit) async {
    await _repo.reply(e.threadId, ThreadMessage(text: '📞 Call requested for ${e.slot}', ts: nowIso()));
    emit(state.copyWith(notice: _next('Call request sent for ${e.slot}')));
  }

  Future<void> _onSend(MessageSent e, Emitter<MessagesState> emit) async {
    await _repo.send(to: e.to, text: e.text.trim(), subject: e.subject.trim(), attach: e.attach);
    if (e.draftId != null) await _repo.deleteDraft(e.draftId!);
    emit(state.copyWith(notice: _next(e.to.length == 1 ? 'Message sent' : 'Message sent to ${e.to.length} recipients', pop: true)));
  }

  Future<void> _onDraft(DraftSaved e, Emitter<MessagesState> emit) async {
    await _repo.saveDraft(e.draft.copyWith(ts: nowIso()));
    emit(state.copyWith(notice: _next('Draft saved', pop: true)));
  }

  Future<void> _onDraftDeleted(DraftDeleted e, Emitter<MessagesState> emit) async {
    await _repo.deleteDraft(e.id);
    emit(state.copyWith(notice: _next('Draft deleted')));
  }

  Future<void> _onAllDrafts(AllDraftsDeleted e, Emitter<MessagesState> emit) async {
    await _repo.deleteAllDrafts();
    emit(state.copyWith(notice: _next('All drafts deleted')));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
