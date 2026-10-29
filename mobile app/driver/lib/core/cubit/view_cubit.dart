import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/view_model.dart';
import '../repositories/view_repository.dart';

/// Feature-scoped screen state and draft lifecycle; widgets never access storage.
class ViewCubit extends Cubit<ViewState> {
  ViewCubit(this.repository) : super(const ViewState());
  final ViewRepository repository;
  int _generation = 0;
  Future<void> load(String id) async {
    final generation = ++_generation;
    emit(state.copy(loading: true));
    try {
      final screen = await repository.load(id);
      if (!isClosed && generation == _generation) {
        emit(
          ViewState(
            screen: screen,
            loading: false,
            values: screen.initialValues,
          ),
        );
      }
    } catch (_) {
      if (!isClosed && generation == _generation) {
        emit(
          state.copy(
            loading: false,
            error: 'This screen could not be loaded. Please retry.',
          ),
        );
      }
    }
  }

  void update(String id, String value) {
    emit(state.copy(values: Map.unmodifiable({...state.values, id: value})));
  }

  void select(String id) {
    final s = {...state.selected};
    s.contains(id) ? s.remove(id) : s.add(id);
    emit(state.copy(selected: Set.unmodifiable(s)));
  }

  void navigate(String id) => emit(state.copy(effect: NavigateTo(id)));
  void notify(String message) => emit(state.copy(effect: ShowMessage(message)));
  Future<void> save() async {
    final screen = state.screen;
    if (screen == null) return;
    try {
      await repository.save(screen.id, state.values);
      if (!isClosed) notify('Saved for this demo session.');
    } catch (_) {
      if (!isClosed) {
        notify('Unable to save. Your changes are still here; please retry.');
      }
    }
  }
}
