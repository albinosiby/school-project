import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/trip_models.dart';
import '../repositories/trip_repository.dart';

/// One shared trip aggregate keeps driver and attendant views consistent.
class TripSessionCubit extends Cubit<TripSnapshot> implements TripRepository {
  TripSessionCubit(this._repository) : super(_repository.current);
  final TripRepository _repository;
  TripSnapshot _publish(TripSnapshot next) {
    emit(next);
    return next;
  }

  @override
  TripSnapshot get current => state;
  @override
  TripSnapshot check(String key) => _publish(_repository.check(key));
  @override
  TripSnapshot start() => _publish(_repository.start());
  @override
  TripSnapshot board(String student) => _publish(_repository.board(student));
  @override
  TripSnapshot handover(String student, String code) =>
      _publish(_repository.handover(student, code));
  @override
  TripSnapshot finish() => _publish(_repository.finish());
  @override
  void clear() {
    _repository.clear();
    emit(_repository.current);
  }

  Map<String, String> get bindings => {
    'trip.boarded': state.boarded.length.toString(),
    'trip.boardedRatio': '${state.boarded.length} / 34',
    'trip.pendingChecks': '${2 - state.checked.length.clamp(0, 2)} Pending',
    'trip.checked': '${14 + state.checked.length.clamp(0, 2)} of 16 Done',
  };
}
