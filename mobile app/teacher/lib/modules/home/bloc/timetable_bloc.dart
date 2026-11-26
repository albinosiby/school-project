import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../repositories/settings_repository_interface.dart';
import '../repositories/timetable_repository_interface.dart';
import 'timetable_events.dart';
import 'timetable_states.dart';

/// Timetable tab and weekly grid: all periods + substitutions, and today's attendance per class and period.
class TimetableBloc extends Bloc<TimetableEvent, TimetableState> {
  TimetableBloc(this._repo, this._settings, [this._attendance]) : super(const TimetableState()) {
    on<TimetableLoadRequested>(_onLoad);
    on<TimetableSyncRequested>(_onSync);
    _subs = [
      for (final s in [_repo.watch(), ?_attendance?.watch()]) s.listen((_) => add(const TimetableLoadRequested())),
    ];
  }

  final ITimetableRepository _repo;
  final ISettingsRepository _settings;
  final IAttendanceRepository? _attendance;
  late final List<StreamSubscription<void>> _subs;

  /// Submitted records (latest per day + class + period) and the periods with only a draft.
  Future<({Map<String, AttCounts> marked, Set<String> drafts})> _registers() async {
    final a = _attendance;
    if (a == null) return (marked: const <String, AttCounts>{}, drafts: const <String>{});
    final latest = <String, AttendanceRecord>{};
    final drafts = <String>{};
    for (final r in await a.getRecords()) {
      final k = TimetableState.attKey(r.date, r.classId, r.period);
      if (!r.submitted) {
        drafts.add(k);
        continue;
      }
      final cur = latest[k];
      if (cur == null || r.updatedAt.compareTo(cur.updatedAt) > 0) latest[k] = r;
    }
    return (marked: {for (final e in latest.entries) e.key: e.value.counts}, drafts: drafts.difference(latest.keys.toSet()));
  }

  Future<void> _onLoad(TimetableLoadRequested e, Emitter<TimetableState> emit) async {
    if (state.status == TimetableStatus.initial) emit(state.copyWith(status: TimetableStatus.loading));
    try {
      final att = await _registers();
      emit(
        state.copyWith(
          status: TimetableStatus.loaded,
          periods: await _repo.getPeriods(),
          subs: await _repo.getSubstitutions(),
          attendance: att.marked,
          attDrafts: att.drafts,
        ),
      );
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
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
