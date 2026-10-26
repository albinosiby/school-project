import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/duty_repository_interface.dart';
import '../repositories/homework_repository_interface.dart';
import '../repositories/syllabus_repository_interface.dart';
import 'duties_events.dart';
import 'duties_states.dart';

/// Duties & reminders list, duty detail and the agenda / swap sheets.
class DutiesBloc extends Bloc<DutiesEvent, DutiesState> {
  DutiesBloc(this._duties, this._homework, this._syllabus, this._school) : super(const DutiesState()) {
    on<DutiesLoadRequested>(_onLoad);
    on<DutyDoneToggled>(_onToggle);
    on<DutyStreamJoined>((e, _) => _duties.markJoined(e.id));
    on<DutySwapRequested>((e, _) => _duties.requestSwap(e.request));
    on<DutySwapCancelled>((e, _) => _duties.cancelSwap(e.swapId));
    _subs = [
      for (final s in [_duties.watch(), _homework.watch(), _syllabus.watch(), _school.watch()]) s.listen((_) => add(const DutiesLoadRequested())),
    ];
  }

  final IDutyRepository _duties;
  final IHomeworkRepository _homework;
  final ISyllabusRepository _syllabus;
  final ISchoolRepository _school;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(DutiesLoadRequested e, Emitter<DutiesState> emit) async {
    if (state.status == DutiesStatus.initial) emit(state.copyWith(status: DutiesStatus.loading));
    try {
      emit(state.copyWith(
        status: DutiesStatus.loaded,
        duties: await _duties.getDuties(),
        swaps: await _duties.getSwaps(),
        homework: await _homework.getAll(),
        students: await _school.getStudents(),
        classes: await _school.getClasses(),
        teacher: await _school.getTeacher(),
        syllabus: await _syllabus.getMeta(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: DutiesStatus.failure, error: err.message));
    }
  }

  Future<void> _onToggle(DutyDoneToggled e, Emitter<DutiesState> emit) async {
    final d = state.dutyById(e.id) ?? await _duties.getDuty(e.id);
    if (d != null) await _duties.setDone(e.id, !d.isDone);
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
