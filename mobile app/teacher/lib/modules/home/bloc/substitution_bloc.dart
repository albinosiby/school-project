import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/timetable_repository_interface.dart';
import 'substitution_events.dart';
import 'substitution_states.dart';

/// Substitution brief & lesson notes for one duty.
class SubstitutionBloc extends Bloc<SubstitutionEvent, SubstitutionState> {
  SubstitutionBloc(this._repo) : super(const SubstitutionState()) {
    on<SubstitutionLoadRequested>(_onLoad);
    on<SubstitutionStatusChanged>((e, _) => _repo.setSubstitutionStatus(state.id, e.status));
    on<SubstitutionTaskToggled>((e, _) => _repo.toggleSubstitutionTask(state.id, e.index));
    _sub = _repo.watch().listen((_) {
      if (state.id.isNotEmpty) add(SubstitutionLoadRequested(state.id));
    });
  }

  final ITimetableRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(SubstitutionLoadRequested e, Emitter<SubstitutionState> emit) async {
    final sub = await _repo.getSubstitution(e.id);
    emit(SubstitutionState(status: sub == null ? SubstitutionLoadStatus.notFound : SubstitutionLoadStatus.loaded, id: e.id, sub: sub));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
