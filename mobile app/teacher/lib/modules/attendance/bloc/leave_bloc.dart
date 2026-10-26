import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/leave_repository_interface.dart';
import 'leave_events.dart';
import 'leave_states.dart';
import 'load_status.dart';

/// Apply Leave (1.4) with class handovers.
class LeaveBloc extends Bloc<LeaveEvent, LeaveState> {
  LeaveBloc(this._repo) : super(const LeaveState()) {
    on<LeaveLoadRequested>((e, emit) async {
      if (state.status == LoadStatus.initial) emit(state.copyWith(status: LoadStatus.loading));
      emit(state.copyWith(
        status: LoadStatus.loaded, quota: await _repo.getQuota(), applications: await _repo.getApplications(),
        periods: await _repo.getHandoverPeriods(), faculty: await _repo.getFaculty(),
      ));
    });
    on<LeaveApplied>((e, _) => _repo.apply(e.application));
    _sub = _repo.watch().listen((_) => add(const LeaveLoadRequested()));
  }

  final ILeaveRepository _repo;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
