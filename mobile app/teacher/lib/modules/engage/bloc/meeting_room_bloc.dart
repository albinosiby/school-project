import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../models/meeting_models.dart';
import '../repositories/meeting_repository_interface.dart';
import 'engage_notice.dart';
import 'meeting_room_events.dart';
import 'meeting_room_states.dart';

/// One meeting's lobby and (simulated) room: participants, waiting room, live chat and agenda.
class MeetingRoomBloc extends Bloc<MeetingRoomEvent, MeetingRoomState> {
  MeetingRoomBloc(this._repo, this._school) : super(const MeetingRoomState()) {
    on<MeetingRoomLoadRequested>(_onLoad);
    on<GuestAdmitted>(_onAdmit);
    on<AllGuestsAdmitted>(_onAdmitAll);
    on<GuestDenied>(_onDeny);
    on<ParticipantMuteToggled>(_onMuteToggled);
    on<AllParticipantsMuted>(_onMuteAll);
    on<ChatMessageSent>(_onChat);
    on<ChatPinToggled>((e, _) => _repo.togglePin(e.chatId));
    on<AgendaTopicAdded>(_onTopic);
    on<MeetingJoined>((e, _) => _repo.markStarted(state.meetingId));
    on<MeetingLeft>(_onLeft);
    _sub = _repo.watch().listen((_) {
      if (state.meetingId.isNotEmpty) add(MeetingRoomLoadRequested(state.meetingId));
    });
  }

  final IMeetingRepository _repo;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  String get _mid => state.meetingId;
  Notice _next(String m, {bool pop = false}) => Notice.next(state.notice, m, pop: pop);

  Future<void> _onLoad(MeetingRoomLoadRequested e, Emitter<MeetingRoomState> emit) async {
    final first = state.meetingId != e.meetingId;
    if (first) emit(state.copyWith(status: EngageStatus.loading, meetingId: e.meetingId));
    try {
      if (first) await _repo.ensureRoom(e.meetingId);
      final m = await _repo.get(e.meetingId);
      emit(MeetingRoomState(
        status: EngageStatus.loaded, meetingId: e.meetingId, meeting: m, notice: state.notice,
        participants: await _repo.getParticipants(e.meetingId), waiting: await _repo.getWaiting(e.meetingId), chat: await _repo.getChat(e.meetingId),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onAdmit(GuestAdmitted e, Emitter<MeetingRoomState> emit) async {
    final g = state.waiting.where((w) => w.id == e.guestId).firstOrNull;
    await _repo.admit(e.guestId);
    emit(state.copyWith(notice: _next('${g?.name ?? 'Guest'} admitted')));
  }

  Future<void> _onAdmitAll(AllGuestsAdmitted e, Emitter<MeetingRoomState> emit) async {
    final n = state.waiting.length;
    if (n == 0) return;
    await _repo.admitAll(_mid);
    emit(state.copyWith(notice: _next('Admitted $n parent${n == 1 ? '' : 's'}')));
  }

  Future<void> _onDeny(GuestDenied e, Emitter<MeetingRoomState> emit) async {
    final g = state.waiting.where((w) => w.id == e.guestId).firstOrNull;
    await _repo.deny(e.guestId);
    emit(state.copyWith(notice: _next('${g?.name ?? 'Guest'} denied')));
  }

  Future<void> _onMuteToggled(ParticipantMuteToggled e, Emitter<MeetingRoomState> emit) async {
    final p = state.participants.where((x) => x.id == e.participantId).firstOrNull;
    if (p != null) await _repo.setMuted(p.id, !p.muted);
  }

  Future<void> _onMuteAll(AllParticipantsMuted e, Emitter<MeetingRoomState> emit) async {
    await _repo.muteAll(_mid);
    emit(state.copyWith(notice: _next('All participants muted')));
  }

  Future<void> _onChat(ChatMessageSent e, Emitter<MeetingRoomState> emit) async {
    final text = e.text.trim();
    if (text.isEmpty) return;
    final me = await _school.getTeacher();
    await _repo.sendChat(ChatMessage(meetingId: _mid, name: me.name, mine: true, ts: nowIso(), text: text));
  }

  Future<void> _onTopic(AgendaTopicAdded e, Emitter<MeetingRoomState> emit) async {
    await _repo.addTopic(_mid, e.topic);
    emit(state.copyWith(notice: _next('Topic added')));
  }

  Future<void> _onLeft(MeetingLeft e, Emitter<MeetingRoomState> emit) async {
    if (e.endForAll) {
      await _repo.complete(_mid, summary: 'Held online for ${(e.seconds / 60).ceil()} min. ${state.headcount} participants joined.');
      emit(state.copyWith(notice: _next('Meeting ended for everyone', pop: true)));
    } else {
      emit(state.copyWith(notice: _next('You left the meeting', pop: true)));
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
