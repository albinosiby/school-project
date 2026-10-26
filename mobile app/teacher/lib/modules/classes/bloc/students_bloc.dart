import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/behaviour_repository_interface.dart';
import '../repositories/classes_repository_interface.dart';
import 'students_events.dart';
import 'students_states.dart';

/// View All Students and Student Profile (overview / academics / attendance).
/// Students come from the global SchoolBloc; this BLoC adds conduct data and actions.
class StudentsBloc extends Bloc<StudentsEvent, StudentsState> {
  StudentsBloc(this._behaviour, this._classes) : super(const StudentsState()) {
    on<StudentsLoadRequested>(_onLoad);
    on<StudentsExportRequested>(_onExport);
    on<GuardianCalled>(_onCall);
    _sub = _behaviour.watch().listen((_) => add(const StudentsLoadRequested()));
  }

  final IBehaviourRepository _behaviour;
  final IClassesRepository _classes;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(StudentsLoadRequested e, Emitter<StudentsState> emit) async {
    if (state.status == StudentsStatus.initial) emit(state.copyWith(status: StudentsStatus.loading));
    try {
      emit(state.copyWith(status: StudentsStatus.loaded, logs: await _behaviour.getLogs()));
    } on AppException catch (err) {
      emit(state.copyWith(status: StudentsStatus.failure, error: err.message));
    }
  }

  Future<void> _onExport(StudentsExportRequested e, Emitter<StudentsState> emit) async {
    await _classes.logExport(e.classId, e.count);
    emit(state.copyWith(notice: 'Export (PDF/XLS) of ${e.count} students prepared', bumpNotice: true));
  }

  Future<void> _onCall(GuardianCalled e, Emitter<StudentsState> emit) async {
    await _classes.logContact(e.studentId, 'call');
    emit(state.copyWith(notice: 'Calling ${e.name} • ${e.phone}', bumpNotice: true));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
