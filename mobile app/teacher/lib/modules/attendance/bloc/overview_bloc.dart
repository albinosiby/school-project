import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/attendance_repository_interface.dart';
import 'load_status.dart';
import 'overview_events.dart';
import 'overview_states.dart';

class OverviewBloc extends Bloc<OverviewEvent, OverviewState> {
  OverviewBloc(this._repo, this._school) : super(const OverviewState()) {
    on<OverviewLoadRequested>((e, emit) async {
      if (state.status == LoadStatus.initial) emit(state.copyWith(status: LoadStatus.loading));
      emit(state.copyWith(
        status: LoadStatus.loaded, classes: await _school.getClasses(), students: await _school.getStudents(),
        schedule: await _repo.getSchedule(), records: await _repo.getRecords(), slips: await _repo.getLeaveSlips(),
      ));
    });
    on<OverviewLeaveSlipApproved>((e, _) => _repo.setLeaveSlipStatus(e.id, 'Approved'));
    _sub = _repo.watch().listen((_) => add(const OverviewLoadRequested()));
  }

  final IAttendanceRepository _repo;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
