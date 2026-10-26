import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus, errorMessage;
import '../repositories/family_repository_interface.dart';
import 'family_events.dart';
import 'family_states.dart';

export 'family_events.dart';
export 'family_states.dart';

/// Global: guardian, children and the selected child (header child switcher).
class FamilyBloc extends Bloc<FamilyEvent, FamilyState> {
  FamilyBloc(this._repo) : super(const FamilyState()) {
    on<LoadFamily>(
      (event, emit) => emit.forEach(
        _repo.watchFamily(),
        onData: (family) => FamilyState(
          status: LoadStatus.loaded,
          family: family,
          selectedId: state.selectedId ?? family.children.firstOrNull?.id,
        ),
        onError: (e, _) => FamilyState(
          status: LoadStatus.error,
          error: errorMessage(e),
          selectedId: state.selectedId,
        ),
      ),
      transformer: restartable(),
    );
    on<SelectChild>((event, emit) {
      if (state.children.any((c) => c.id == event.childId)) {
        emit(
          FamilyState(
            status: state.status,
            family: state.family,
            selectedId: event.childId,
          ),
        );
      }
    });
    on<ClearFamily>((event, emit) => emit(const FamilyState()));
  }

  final IFamilyRepository _repo;
}
