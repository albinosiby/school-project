import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart';
import '../models/trip_models.dart';
import '../repositories/trip_repository_interface.dart';

/// Today's trips of a bus (key = "busId|date").
class DayTripsBloc extends DataBloc<List<Trip>> {
  DayTripsBloc(ITripRepository repo)
      : super((key) {
          final p = key.split('|');
          return repo.watchDay(p.first, p.length > 1 ? p[1] : '');
        });
}

/// Past trips of a bus (key = busId).
class TripHistoryBloc extends DataBloc<List<Trip>> {
  TripHistoryBloc(ITripRepository repo) : super(repo.watchHistory);
}

/// Checklist / start / end actions on one trip.
class TripActionState extends Equatable {
  const TripActionState({this.busy = false, this.error, this.done});
  final bool busy;
  final String? error, done;
  @override
  List<Object?> get props => [busy, error, done];
}

sealed class TripActionEvent extends Equatable {
  const TripActionEvent();
  @override
  List<Object?> get props => [];
}

class SaveChecklist extends TripActionEvent {
  const SaveChecklist(this.trip, this.checklist);
  final Trip trip;
  final Checklist checklist;
  @override
  List<Object?> get props => [trip, checklist];
}

class StartTrip extends TripActionEvent {
  const StartTrip(this.trip, {this.odometer});
  final Trip trip;
  final int? odometer;
  @override
  List<Object?> get props => [trip, odometer];
}

class EndTrip extends TripActionEvent {
  const EndTrip(this.trip, {this.odometer, this.note = ''});
  final Trip trip;
  final int? odometer;
  final String note;
  @override
  List<Object?> get props => [trip, odometer, note];
}

class SetStop extends TripActionEvent {
  const SetStop(this.trip, this.stopId);
  final Trip trip;
  final String? stopId;
  @override
  List<Object?> get props => [trip, stopId];
}

class TripActionBloc extends Bloc<TripActionEvent, TripActionState> {
  TripActionBloc(this._repo) : super(const TripActionState()) {
    on<SaveChecklist>((e, emit) => _run(emit, () => _repo.saveChecklist(e.trip, e.checklist), 'Checklist saved'), transformer: sequential());
    on<StartTrip>((e, emit) async {
      if (e.trip.needsChecklist) {
        emit(const TripActionState(error: 'Complete the pre-trip checklist before starting.'));
        return;
      }
      await _run(emit, () => _repo.startTrip(e.trip, odometer: e.odometer), 'Trip started');
    }, transformer: droppable());
    on<EndTrip>((e, emit) => _run(emit, () => _repo.endTrip(e.trip, odometer: e.odometer, note: e.note), 'Trip completed'), transformer: droppable());
    on<SetStop>((e, emit) => _run(emit, () => _repo.setCurrentStop(e.trip, e.stopId), null), transformer: sequential());
  }
  final ITripRepository _repo;

  Future<void> _run(Emitter<TripActionState> emit, Future<void> Function() op, String? done) async {
    emit(const TripActionState(busy: true));
    try {
      await op();
      emit(TripActionState(done: done));
    } catch (err) {
      emit(TripActionState(error: errorMessage(err)));
    }
  }
}
