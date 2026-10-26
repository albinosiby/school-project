import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/syllabus_repository_interface.dart';
import 'syllabus_events.dart';
import 'syllabus_states.dart';

/// Monthly syllabus progress log.
class SyllabusBloc extends Bloc<SyllabusEvent, SyllabusState> {
  SyllabusBloc(this._repo) : super(const SyllabusState()) {
    on<SyllabusLoadRequested>(_onLoad);
    on<SyllabusPeriodLogged>((e, _) => _repo.logPeriod(e.divisionId, e.topicIndex));
    on<SyllabusSubmissionToggled>((e, _) => _repo.setSubmitted(!state.meta.submitted));
    _sub = _repo.watch().listen((_) => add(const SyllabusLoadRequested()));
  }

  final ISyllabusRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(SyllabusLoadRequested e, Emitter<SyllabusState> emit) async {
    if (state.status == SyllabusStatus.initial) emit(state.copyWith(status: SyllabusStatus.loading));
    try {
      emit(state.copyWith(status: SyllabusStatus.loaded, divisions: await _repo.getDivisions(), meta: await _repo.getMeta()));
    } on AppException catch (err) {
      emit(state.copyWith(status: SyllabusStatus.failure, error: err.message));
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
