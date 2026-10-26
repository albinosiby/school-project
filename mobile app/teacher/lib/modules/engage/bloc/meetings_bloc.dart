import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/meeting_models.dart';
import '../repositories/meeting_repository_interface.dart';
import 'engage_notice.dart';
import 'meetings_events.dart';
import 'meetings_states.dart';

/// Parent-teacher meeting list and the schedule form.
class MeetingsBloc extends Bloc<MeetingsEvent, MeetingsState> {
  MeetingsBloc(this._repo) : super(const MeetingsState()) {
    on<MeetingsLoadRequested>(_onLoad);
    on<MeetingSaved>(_onSaved);
    on<MeetingDeleted>(_onDeleted);
    _sub = _repo.watch().listen((_) => add(const MeetingsLoadRequested()));
  }

  final IMeetingRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(MeetingsLoadRequested e, Emitter<MeetingsState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(status: EngageStatus.loaded, meetings: await _repo.getAll()));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onSaved(MeetingSaved e, Emitter<MeetingsState> emit) async {
    final m = e.meeting;
    await _repo.save(Meeting.fromJson({...m.toJson(), 'status': (e.draft ? MeetingStatus.draft : MeetingStatus.upcoming).name}));
    final msg = e.draft ? 'Draft saved' : (m.invite ? 'Invites sent to ${m.total} parents' : 'Meeting scheduled');
    emit(state.copyWith(notice: Notice.next(state.notice, msg, pop: true)));
  }

  Future<void> _onDeleted(MeetingDeleted e, Emitter<MeetingsState> emit) async {
    await _repo.delete(e.id);
    emit(state.copyWith(notice: Notice.next(state.notice, 'Meeting deleted')));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
