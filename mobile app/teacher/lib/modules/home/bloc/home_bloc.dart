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

  /// Latest submitted record of today per class, and the classes that only have a draft today.
  Future<({Map<String, AttCounts> today, Set<String> drafts})> _today() async {
    final a = _attendance;
    if (a == null) return (today: const <String, AttCounts>{}, drafts: const <String>{});
    final day = dkey(todayDate());
    final latest = <String, AttendanceRecord>{};
    final drafts = <String>{};
    for (final r in await a.getRecords()) {
      if (r.date != day) continue;
      if (!r.submitted) {
        drafts.add(r.classId);
        continue;
      }
      final cur = latest[r.classId];
      if (cur == null || r.updatedAt.compareTo(cur.updatedAt) > 0) latest[r.classId] = r;
    }
    return (today: {for (final e in latest.entries) e.key: e.value.counts}, drafts: drafts.difference(latest.keys.toSet()));
  }
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(HomeLoadRequested e, Emitter<HomeState> emit) async {
    if (state.status == HomeStatus.initial) emit(state.copyWith(status: HomeStatus.loading));
    try {
      final att = await _today();
      emit(state.copyWith(
        status: HomeStatus.loaded,
        pending: await _home.getPending(),
        reminders: await _home.getReminders(),
        periods: await _timetable.getPeriods(),
        subs: await _timetable.getSubstitutions(),
        today: att.today,
        drafts: att.drafts,
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
