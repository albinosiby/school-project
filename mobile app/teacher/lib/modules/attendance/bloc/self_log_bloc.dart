import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/attendance_models.dart';
import '../repositories/attendance_repository_interface.dart';
import '../repositories/leave_repository_interface.dart';
import 'load_status.dart';
import 'self_log_events.dart';
import 'self_log_states.dart';

/// Staff self-log (1.1.3): punches, monthly cycle, leave balances, regularization requests.
class SelfLogBloc extends Bloc<SelfLogEvent, SelfLogState> {
  SelfLogBloc(this._repo, this._leave) : super(const SelfLogState()) {
    on<SelfLogLoadRequested>((e, emit) async {
      if (state.status == LoadStatus.initial) emit(state.copyWith(status: LoadStatus.loading));
      emit(state.copyWith(
        status: LoadStatus.loaded, logs: await _repo.getStaffLogs(), regs: await _repo.getRegularizations(), quota: await _leave.getQuota(),
      ));
    });
    on<SelfLogPunchedIn>((e, _) => _repo.punchIn(StaffLog(
          id: 'sl_${dkey(todayDate())}', date: dkey(todayDate()), inTime: e.time,
          status: mins(e.time) <= mins(onTimeBy) ? 'Present' : 'Late', note: 'Campus Main Gate (Verified)',
        )));
    on<SelfLogPunchedOut>((e, _) async {
      final t = state.today;
      if (t != null) await _repo.punchOut(t.id, e.time);
    });
    on<SelfLogRegularizationSubmitted>((e, _) => _repo.addRegularization(e.request));
    _sub = _repo.watch().listen((_) => add(const SelfLogLoadRequested()));
  }

  final IAttendanceRepository _repo;
  final ILeaveRepository _leave;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
