import 'dart:async';
import '../../../core/bloc/child_data_bloc.dart';
import '../models/transport_models.dart';
import '../repositories/transport_repository_interface.dart';
import 'track_live_events.dart';

export 'track_live_events.dart';
export 'track_live_states.dart';

/// Live bus trip of the selected child. While the BLoC is alive it polls the GPS every
/// [pollInterval]; the repository stream then emits the moved bus (ETA, next stop, position).
class TrackLiveBloc extends ChildDataBloc<BusTrip> {
  TrackLiveBloc(this._repo) : super(_repo.watchTrip) {
    on<ToggleBusAlert>((event, emit) {
      final id = state.childId;
      if (id != null) return _repo.setAlert(id, event.alert, event.enabled);
    });
    on<PollBusPosition>((event, emit) {
      final id = state.childId;
      if (id != null) return _repo.pollPosition(id);
    });
    final every = pollInterval;
    if (every != null) {
      _timer = Timer.periodic(every, (_) => add(const PollBusPosition()));
    }
  }

  /// Live feed period; null turns polling off (tests drive it with [PollBusPosition]).
  static Duration? pollInterval = const Duration(seconds: 4);

  final ITransportRepository _repo;
  Timer? _timer;

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}
