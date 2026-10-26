import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../repositories/home_repository_interface.dart';
import '../repositories/settings_repository_interface.dart';
import '../repositories/timetable_repository_interface.dart';
import 'home_events.dart';
import 'home_states.dart';

/// Home tab: pending tasks, reminders, today's periods (for the now card) and today's attendance per class.
class HomeBloc extends Bloc<HomeEvent, HomeState> {
  HomeBloc(this._home, this._timetable, this._settings, [this._attendance]) : super(const HomeState()) {
    on<HomeLoadRequested>(_onLoad);
    on<HomeTaskCompleted>((e, _) => _home.setPendingDone(e.id));
    _subs = [
      for (final s in [_home.watch(), _timetable.watch(), _settings.watch(), ?_attendance?.watch()]) s.listen((_) => add(const HomeLoadRequested())),
    ];
  }

  final IHomeRepository _home;
  final ITimetableRepository _timetable;
  final ISettingsRepository _settings;
  final IAttendanceRepository? _attendance;

  /// Latest submitted record of today per class.
  Future<Map<String, AttCounts>> _today() async {
    final a = _attendance;
    if (a == null) return const {};
    final day = dkey(todayDate());
    final latest = <String, AttendanceRecord>{};
    for (final r in await a.getRecords()) {
      if (r.date != day || !r.submitted) continue;
      final cur = latest[r.classId];
      if (cur == null || r.updatedAt.compareTo(cur.updatedAt) > 0) latest[r.classId] = r;
    }
    return {for (final e in latest.entries) e.key: e.value.counts};
  }
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(HomeLoadRequested e, Emitter<HomeState> emit) async {
    if (state.status == HomeStatus.initial) emit(state.copyWith(status: HomeStatus.loading));
    try {
      emit(state.copyWith(
        status: HomeStatus.loaded,
        pending: await _home.getPending(),
        reminders: await _home.getReminders(),
        periods: await _timetable.getPeriods(),
        subs: await _timetable.getSubstitutions(),
        today: await _today(),
      ));
    } catch (err) {
      emit(state.copyWith(status: HomeStatus.failure, error: '$err'));
    }
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
