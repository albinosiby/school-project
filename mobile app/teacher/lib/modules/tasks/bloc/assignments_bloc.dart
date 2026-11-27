import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/homework_repository_interface.dart';
import 'assignments_events.dart';
import 'assignments_states.dart';

/// Assignments page: every assignment across the teacher's classes. Reloads when assignments or the school change.
class AssignmentsBloc extends Bloc<AssignmentsEvent, AssignmentsState> {
  AssignmentsBloc(this._homework, this._school) : super(const AssignmentsState()) {
    on<AssignmentsLoadRequested>(_onLoad);
    _subs = [
      for (final s in [_homework.watch(), _school.watch()]) s.listen((_) => add(const AssignmentsLoadRequested())),
    ];
  }

  final IHomeworkRepository _homework;
  final ISchoolRepository _school;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(AssignmentsLoadRequested e, Emitter<AssignmentsState> emit) async {
    if (state.status == AssignmentsStatus.initial) emit(state.copyWith(status: AssignmentsStatus.loading));
    try {
      emit(state.copyWith(
        status: AssignmentsStatus.loaded,
        homework: await _homework.getAll(),
        classes: await _school.getClasses(),
        students: await _school.getStudents(),
      ));
    } on AppException catch (err) {
      if (state.status != AssignmentsStatus.loaded) emit(state.copyWith(status: AssignmentsStatus.failure, error: err.message));
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
