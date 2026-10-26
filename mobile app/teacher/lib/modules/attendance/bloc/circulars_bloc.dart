import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repositories/circulars_repository_interface.dart';
import 'circulars_events.dart';
import 'circulars_states.dart';
import 'load_status.dart';

/// Circulars list (1.5) and detail (1.5.1).
class CircularsBloc extends Bloc<CircularsEvent, CircularsState> {
  CircularsBloc(this._repo) : super(const CircularsState()) {
    on<CircularsLoadRequested>((e, emit) async {
      if (state.status == LoadStatus.initial) emit(state.copyWith(status: LoadStatus.loading));
      emit(state.copyWith(status: LoadStatus.loaded, items: await _repo.getAll()));
    });
    on<CircularsCategoryChanged>((e, emit) => emit(state.copyWith(category: e.category)));
    on<CircularsQueryChanged>((e, emit) => emit(state.copyWith(query: e.query)));
    on<CircularsUnreadToggled>((e, emit) => emit(state.copyWith(unreadOnly: !state.unreadOnly)));
    on<CircularsSortToggled>((e, emit) => emit(state.copyWith(newestFirst: !state.newestFirst)));
    on<CircularPinToggled>((e, _) async {
      final c = await _repo.get(e.id);
      if (c != null) await _repo.setPinned(e.id, !c.pinned);
    });
    on<CircularOpened>((e, _) => _repo.markRead(e.id));
    on<CircularAcknowledged>((e, _) => _repo.acknowledge(e.id));
    _sub = _repo.watch().listen((_) => add(const CircularsLoadRequested()));
  }

  final ICircularsRepository _repo;
  late final StreamSubscription<void> _sub;

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
