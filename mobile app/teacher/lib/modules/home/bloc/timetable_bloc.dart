import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/settings_repository_interface.dart';
import '../repositories/timetable_repository_interface.dart';
import 'timetable_events.dart';
import 'timetable_states.dart';

/// Timetable tab and weekly grid: all periods + substitutions.
class TimetableBloc extends Bloc<TimetableEvent, TimetableState> {
  TimetableBloc(this._repo, this._settings) : super(const TimetableState()) {
    on<TimetableLoadRequested>(_onLoad);
    on<TimetableSyncRequested>(_onSync);
    _sub = _repo.watch().listen((_) => add(const TimetableLoadRequested()));
  }

  final ITimetableRepository _repo;
  final ISettingsRepository _settings;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(TimetableLoadRequested e, Emitter<TimetableState> emit) async {
    if (state.status == TimetableStatus.initial) emit(state.copyWith(status: TimetableStatus.loading));
    try {
      emit(state.copyWith(status: TimetableStatus.loaded, periods: await _repo.getPeriods(), subs: await _repo.getSubstitutions()));
    } catch (err) {
      emit(state.copyWith(status: TimetableStatus.failure, error: '$err'));
    }
  }

  Future<void> _onSync(TimetableSyncRequested e, Emitter<TimetableState> emit) async {
    if (state.syncing) return;
    emit(state.copyWith(syncing: true));
    await _settings.sync();
    emit(state.copyWith(syncing: false, syncCount: state.syncCount + 1));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
