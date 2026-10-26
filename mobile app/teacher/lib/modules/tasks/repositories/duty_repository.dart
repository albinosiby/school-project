import '../../../utils/services/data_store.dart';
import '../models/duty_models.dart';
import 'duty_repository_interface.dart';

class LocalDutyRepository implements IDutyRepository {
  LocalDutyRepository(this._db);
  final DataStore _db;
  static const _duties = 'tk_duties', _swaps = 'tk_swaps';

  @override
  Future<List<Duty>> getDuties() async => [for (final r in _db.list(_duties)) Duty.fromJson(r)];

  @override
  Future<Duty?> getDuty(String id) async {
    final r = _db.byId(_duties, id);
    return r == null ? null : Duty.fromJson(r);
  }

  @override
  Future<void> setDone(String id, bool done) async => _db.update(_duties, id, {'status': done ? 'done' : 'upcoming'});

  @override
  Future<void> markJoined(String id) async => _db.update(_duties, id, {'joinedAt': DateTime.now().toIso8601String()});

  @override
  Future<List<SwapRequest>> getSwaps() async => [for (final r in _db.list(_swaps)) SwapRequest.fromJson(r)];

  @override
  Future<SwapRequest> requestSwap(SwapRequest request) async => SwapRequest.fromJson(_db.add(_swaps, request.toJson()));

  @override
  Future<void> cancelSwap(String id) async => _db.remove(_swaps, id);

  @override
  Stream<void> watch() => _db.watch({_duties, _swaps});
}
