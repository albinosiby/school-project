import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/more_repository_interface.dart';
import 'more_events.dart';
import 'more_states.dart';

/// More hub summary counts. Reloads when any summarised collection changes.
class MoreBloc extends Bloc<MoreEvent, MoreState> {
  MoreBloc(this._repo) : super(const MoreState()) {
    on<MoreLoadRequested>(_onLoad);
    _sub = _repo.watch().listen((_) => add(const MoreLoadRequested()));
  }

  final IMoreRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(MoreLoadRequested e, Emitter<MoreState> emit) async {
    if (state.status == MoreStatus.initial) emit(state.copyWith(status: MoreStatus.loading));
    try {
      emit(state.copyWith(status: MoreStatus.loaded, summary: await _repo.getSummary()));
    } on AppException catch (err) {
      emit(state.copyWith(status: MoreStatus.failure, error: err.message));
    }
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
