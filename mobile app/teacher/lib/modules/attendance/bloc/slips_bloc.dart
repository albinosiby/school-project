import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/attendance_repository_interface.dart';
import 'load_status.dart';
import 'slips_events.dart';
import 'slips_states.dart';

class SlipsBloc extends Bloc<SlipsEvent, SlipsState> {
  SlipsBloc(this._repo, this._school) : super(const SlipsState()) {
    on<SlipsLoadRequested>((e, emit) async {
      if (state.status == LoadStatus.initial) emit(state.copyWith(status: LoadStatus.loading));
      emit(state.copyWith(
        status: LoadStatus.loaded, classes: await _school.getClasses(), students: await _school.getStudents(),
        records: await _repo.getRecords(), medical: await _repo.getMedicalSlips(), leaveSlips: await _repo.getLeaveSlips(),
      ));
    });
    on<MedicalSlipDecided>((e, _) async {
      final me = await _school.getTeacher();
      await _repo.decideMedicalSlip(e.id, approved: e.approved, by: me.name, reason: e.reason);
    });
    on<LeaveSlipStatusChanged>((e, _) => _repo.setLeaveSlipStatus(e.id, e.status, note: e.note));
    _sub = _repo.watch().listen((_) => add(const SlipsLoadRequested()));
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
