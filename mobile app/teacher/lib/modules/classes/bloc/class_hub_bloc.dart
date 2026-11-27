import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../tasks/repositories/homework_repository_interface.dart';
import 'class_hub_events.dart';
import 'class_hub_states.dart';

/// Registers, leave requests and homework for the Classes tab and the class page; reloads on any change.
class ClassHubBloc extends Bloc<ClassHubEvent, ClassHubState> {
  ClassHubBloc(this._attendance, this._homework) : super(const ClassHubState()) {
    on<ClassHubLoadRequested>((e, emit) async {
      if (state.status == ClassHubStatus.initial) emit(state.copyWith(status: ClassHubStatus.loading));
      emit(state.copyWith(
        status: ClassHubStatus.loaded,
        records: await _attendance.getRecords(),
        leaves: await _attendance.getLeaveSlips(),
        homework: await _homework.getAll(),
      ));
    });
    _subs = [
      for (final s in [_attendance.watch(), _homework.watch()]) s.listen((_) => add(const ClassHubLoadRequested())),
    ];
  }

  final IAttendanceRepository _attendance;
  final IHomeworkRepository _homework;
  late final List<StreamSubscription<void>> _subs;

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
