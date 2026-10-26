import 'dart:async';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/behaviour_models.dart';
import 'behaviour_demo_data.dart';
import 'behaviour_repository_interface.dart';

class MockBehaviourRepository implements IBehaviourRepository {
  MockBehaviourRepository(this._cache);
  final CacheService _cache;
  final Map<String, Map<String, String?>> _acks =
      {}; // childId -> entryId -> note
  final _changes = StreamController<void>.broadcast();

  BehaviourReport _build(String childId) {
    final r = BehaviourDemoData.report(childId);
    final acks = _acks[childId] ?? const {};
    final entries = [
      for (final e in r.entries)
        acks.containsKey(e.id) ? e.acknowledge(acks[e.id]) : e,
    ]..sort((a, b) => b.at.compareTo(a.at));
    return r.copyWith(entries: entries);
  }

  @override
  Stream<BehaviourReport> watchReport(String childId) => cacheFirst(
    cache: _cache,
    key: 'behaviour:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<void> acknowledge(
    String childId,
    String entryId, {
    String? note,
  }) async {
    await MockLatency.wait();
    (_acks[childId] ??= {})[entryId] = note;
    _changes.add(null);
  }
}
