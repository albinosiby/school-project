import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/attachment_models.dart';
import '../models/message_models.dart';
import '../repositories/chat_media_repository.dart';
import '../repositories/message_repository_interface.dart';
import 'engage_notice.dart';
import 'messages_events.dart';
import 'messages_states.dart';

/// Inbox, conversation view, compose and drafts.
class MessagesBloc extends Bloc<MessagesEvent, MessagesState> {
  MessagesBloc(this._repo, [IChatMediaRepository? media]) : _media = media ?? LocalChatMediaRepository(), super(const MessagesState()) {
    on<MessagesLoadRequested>(_onLoad);
    on<AttachmentsSent>(_onAttachments);
    on<VoiceSent>(_onVoice);
    on<MeetingScheduled>(_onMeeting);
    on<MeetingRescheduled>(_onReschedule);
    on<MeetingCancelled>(_onCancelMeeting);
    on<ChatPresenceChanged>((e, _) => _media.setPresence(e.threadId));
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
  final IChatMediaRepository _media;
  late final StreamSubscription<void> _sub;

  Notice _next(String m, {bool pop = false}) => Notice.next(state.notice, m, pop: pop);

  Future<void> _onLoad(MessagesLoadRequested e, Emitter<MessagesState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(
        status: EngageStatus.loaded, threads: await _repo.getThreads(), drafts: await _repo.getDrafts(), recipients: await _repo.getRecipients(),
        meetings: await _repo.getMeetings(),
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

  // A local placeholder bubble shows at once; it is replaced by the real message when the upload and write land.
  Map<String, List<ThreadMessage>> _withPending(String threadId, ThreadMessage m, {bool add = true}) {
    final next = {for (final e in state.pending.entries) e.key: [...e.value]};
    final list = next[threadId] ?? <ThreadMessage>[];
    add ? list.add(m) : list.removeWhere((x) => x.ts == m.ts);
    next[threadId] = list;
    return next;
  }

  Future<void> _sendUpload(Emitter<MessagesState> emit, String threadId, {required String path, required String name, required String kind, int durationMs = 0}) async {
    final placeholder = ThreadMessage(ts: nowIso(), attach: FileRef(name: name, kind: kind, url: path, path: path, durationMs: durationMs));
    emit(state.copyWith(uploading: state.uploading + 1, pending: _withPending(threadId, placeholder)));
    try {
      final ref = await _media.upload(threadId: threadId, path: path, name: name, kind: kind, durationMs: durationMs);
      await _repo.reply(threadId, ThreadMessage(ts: placeholder.ts, attach: ref));
    } finally {
      emit(state.copyWith(uploading: (state.uploading - 1).clamp(0, 1 << 20), pending: _withPending(threadId, placeholder, add: false)));
    }
  }

  Future<void> _onAttachments(AttachmentsSent e, Emitter<MessagesState> emit) async {
    if (e.files.isEmpty) return;
    var failed = 0;
    for (final f in e.files) {
      try {
        await _sendUpload(emit, e.threadId, path: f.path, name: f.name, kind: f.isImage ? 'image' : 'file');
      } catch (_) {
        failed++;
      }
    }
    if (failed > 0) emit(state.copyWith(notice: _next(failed == e.files.length ? 'Could not upload. Check your connection and try again.' : '$failed of ${e.files.length} files failed to upload')));
  }

  Future<void> _onVoice(VoiceSent e, Emitter<MessagesState> emit) async {
    try {
      final name = 'Voice note ${DateTime.now().toIso8601String().substring(11, 16)}.m4a';
      await _sendUpload(emit, e.threadId, path: e.clip.path, name: name, kind: 'audio', durationMs: e.clip.duration.inMilliseconds);
    } catch (_) {
      emit(state.copyWith(notice: _next('Could not send the voice note. Try again.')));
    }
  }

  Future<void> _onMeeting(MeetingScheduled e, Emitter<MessagesState> emit) async {
    await _repo.scheduleMeeting(e.threadId, e.meeting);
    emit(state.copyWith(notice: _next('Meeting scheduled. Reminders are set for both of you.')));
  }

  Future<void> _onReschedule(MeetingRescheduled e, Emitter<MessagesState> emit) async {
    await _repo.rescheduleMeeting(e.meetingId, e.next);
    emit(state.copyWith(notice: _next('Meeting rescheduled')));
  }

  Future<void> _onCancelMeeting(MeetingCancelled e, Emitter<MessagesState> emit) async {
    await _repo.cancelMeeting(e.meetingId);
    emit(state.copyWith(notice: _next('Meeting cancelled')));
  }

  Future<void> _onCall(CallRequested e, Emitter<MessagesState> emit) async {
    await _repo.reply(e.threadId, ThreadMessage(text: '📞 Call requested for ${e.slot}', ts: nowIso()));
    emit(state.copyWith(notice: _next('Call request sent for ${e.slot}')));
  }

  Future<void> _onSend(MessageSent e, Emitter<MessagesState> emit) async {
    // guardians without a parent app login cannot receive messages: say so instead of failing silently
    final to = <String>[], skipped = <String>[];
    for (final id in e.to) {
      final r = await _repo.resolveRecipient(id);
      if (r != null && !r.available) {
        skipped.add('${r.name} (${r.blocked})');
      } else {
        to.add(id);
      }
    }
    if (to.isEmpty) {
      emit(state.copyWith(notice: _next('Not sent: ${skipped.join(', ')}')));
      return;
    }
    // compose attachments are uploaded to the sender's outbox folder before the threads exist
    final attach = [...e.attach];
    if (e.files.isNotEmpty) {
      emit(state.copyWith(uploading: state.uploading + e.files.length));
      for (final f in e.files) {
        try {
          attach.add(await _media.upload(threadId: 'outbox', path: f.path, name: f.name, kind: f.isImage ? 'image' : 'file'));
        } catch (_) {
          emit(state.copyWith(notice: _next('${f.name} could not be uploaded and was skipped')));
        }
        emit(state.copyWith(uploading: (state.uploading - 1).clamp(0, 1 << 20)));
      }
    }
    await _repo.send(to: to, text: e.text.trim(), subject: e.subject.trim(), attach: attach);
    if (e.draftId != null) await _repo.deleteDraft(e.draftId!);
    final sent = to.length == 1 ? 'Message sent' : 'Message sent to ${to.length} recipients';
    emit(state.copyWith(notice: _next(skipped.isEmpty ? sent : '$sent. Not sent: ${skipped.join(', ')}', pop: true)));
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
