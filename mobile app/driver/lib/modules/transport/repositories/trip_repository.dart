import '../models/trip_models.dart';

abstract interface class TripRepository {
  TripSnapshot get current;
  TripSnapshot check(String key);
  TripSnapshot start();
  TripSnapshot board(String student);
  TripSnapshot handover(String student, String code);
  TripSnapshot finish();
  void clear();
}

class LocalTripRepository implements TripRepository {
  TripSnapshot _state = const TripSnapshot();
  @override
  TripSnapshot get current => _state;
  @override
  TripSnapshot check(String key) {
    final keys = {..._state.checked};
    keys.contains(key) ? keys.remove(key) : keys.add(key);
    return _state = TripSnapshot(
      status: _state.status,
      boarded: _state.boarded,
      checked: Set.unmodifiable(keys),
      handedOver: _state.handedOver,
    );
  }

  @override
  TripSnapshot start() {
    if (_state.checked.length < 2) {
      throw StateError('Complete the two manual pre-trip safety checks first.');
    }
    return _state = TripSnapshot(
      status: TripStatus.active,
      checked: _state.checked,
    );
  }

  @override
  TripSnapshot board(String student) {
    if (_state.status != TripStatus.active) {
      throw StateError('Start the trip before recording boarding.');
    }
    return _state = TripSnapshot(
      status: _state.status,
      checked: _state.checked,
      boarded: Set.unmodifiable({..._state.boarded, student}),
      handedOver: _state.handedOver,
    );
  }

  @override
  TripSnapshot handover(String student, String code) {
    if (code != '4092') throw StateError('Demo handover code is 4092.');
    return _state = TripSnapshot(
      status: _state.status,
      checked: _state.checked,
      boarded: _state.boarded,
      handedOver: Set.unmodifiable({..._state.handedOver, student}),
    );
  }

  @override
  TripSnapshot finish() {
    if (_state.status != TripStatus.active) {
      throw StateError('No active trip to finish.');
    }
    return _state = TripSnapshot(
      status: TripStatus.completed,
      checked: _state.checked,
      boarded: _state.boarded,
      handedOver: _state.handedOver,
    );
  }

  @override
  void clear() {
    _state = const TripSnapshot();
  }
}
