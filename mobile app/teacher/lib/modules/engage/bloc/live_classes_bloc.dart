import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/live_class_models.dart';
import '../../../utils/services/google/google_workspace_service.dart';
import '../repositories/live_class_repository_interface.dart';
import '../repositories/meet_scheduling_repository_interface.dart';
import 'engage_notice.dart';
import 'live_classes_events.dart';
import 'live_classes_states.dart';

/// Live classes list, lobby/in-class actions and the schedule form.
class LiveClassesBloc extends Bloc<LiveClassesEvent, LiveClassesState> {
  LiveClassesBloc(this._repo, [this._meet]) : super(const LiveClassesState()) {
    on<LiveMeetCreateRequested>(_onCreateMeet);
    on<LiveClassesLoadRequested>(_onLoad);
    on<LiveSessionSaved>(_onSaved);
    on<LiveSessionDeleted>(_onDeleted);
    on<LiveSessionStarted>((e, _) => _repo.setStatus(e.id, LiveStatus.live));
    on<LiveSessionEnded>(_onEnded);
    on<LiveSessionJoinOpened>(_onJoinOpened);
    _sub = _repo.watch().listen((_) => add(const LiveClassesLoadRequested()));
  }

  final ILiveClassRepository _repo;
  final IMeetSchedulingRepository? _meet;
  late final StreamSubscription<void> _sub;

  Future<void> _onCreateMeet(LiveMeetCreateRequested e, Emitter<LiveClassesState> emit) async {
    final meet = _meet;
    if (meet == null || state.meetBusy) return;
    emit(state.copyWith(meetBusy: true));
    try {
      final m = await meet.createMeeting();
      emit(state.copyWith(meetBusy: false, meeting: m, notice: Notice.next(state.notice, 'Google Meet created: ${m.uri.replaceFirst('https://', '')}')));
    } on GoogleWorkspaceException catch (err) {
      emit(state.copyWith(meetBusy: false, notice: err.cancelled ? null : Notice.next(state.notice, err.message, error: true)));
    }
  }

  Future<void> _onLoad(LiveClassesLoadRequested e, Emitter<LiveClassesState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(status: EngageStatus.loaded, sessions: await _repo.getAll()));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onSaved(LiveSessionSaved e, Emitter<LiveClassesState> emit) async {
    var s = e.session;
    // scheduled Google Meet classes go on (or stay in step with) the teacher's Google Calendar
    String? calendarProblem;
    final meet = _meet;
    if (!e.draft && meet != null && s.medium == 'Google Meet' && s.calendarSync && s.link.isNotEmpty) {
      try {
        s = await meet.syncCalendar(s);
      } on GoogleWorkspaceException catch (err) {
        calendarProblem = err.cancelled ? 'not added to Google Calendar' : 'Google Calendar: ${err.message}';
      }
    }
    await _repo.save(LiveSession.fromJson({...s.toJson(), 'status': (e.draft ? LiveStatus.draft : LiveStatus.upcoming).name}));
    var msg = e.draft ? 'Draft saved' : (s.notify ? 'Class scheduled — ${s.total} students & parents notified' : 'Class scheduled');
    if (!e.draft && s.calendarEventId.isNotEmpty && calendarProblem == null) msg = '$msg · added to your Google Calendar';
    if (calendarProblem != null) msg = '$msg ($calendarProblem)';
    emit(state.copyWith(notice: Notice.next(state.notice, msg, pop: true)));
  }

  Future<void> _onDeleted(LiveSessionDeleted e, Emitter<LiveClassesState> emit) async {
    final s = await _repo.get(e.id);
    if (s != null && s.calendarEventId.isNotEmpty) {
      try {
        await _meet?.removeFromCalendar(s);
      } on GoogleWorkspaceException {
        // the class is still cancelled here; the calendar entry can be removed by hand
      }
    }
    await _repo.delete(e.id);
    emit(state.copyWith(notice: Notice.next(state.notice, e.message)));
  }

  Future<void> _onEnded(LiveSessionEnded e, Emitter<LiveClassesState> emit) async {
    final s = await _repo.get(e.id);
    if (s == null) return;
    await _repo.setStatus(e.id, LiveStatus.past, joined: s.joined == 0 ? 1 : s.joined);
    emit(state.copyWith(notice: Notice.next(state.notice, 'Class ended and recording saved', pop: true)));
  }

  Future<void> _onJoinOpened(LiveSessionJoinOpened e, Emitter<LiveClassesState> emit) async {
    try {
      await _repo.recordJoin(e.id);
    } catch (_) {
      // recording the join must never block opening the class
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
