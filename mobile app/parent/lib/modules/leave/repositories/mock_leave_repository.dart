import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/leave_models.dart';
import 'leave_repository_interface.dart';

class MockLeaveRepository implements ILeaveRepository {
  MockLeaveRepository(this._cache);
  final CacheService _cache;
  final Map<String, List<LeaveRequest>> _added = {};
  final _changes = StreamController<void>.broadcast();

  List<LeaveRequest> _build(String childId) =>
      [...?_added[childId], ...DemoData.leaves(childId)]
        ..sort((a, b) => b.appliedOn.compareTo(a.appliedOn));

  @override
  Stream<List<LeaveRequest>> watchLeaves(String childId) => cacheFirst(
    cache: _cache,
    key: 'leave:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<LeaveRequest> apply({
    required String childId,
    required DateTime from,
    required DateTime to,
    required String reason,
  }) async {
    await MockLatency.wait();
    final r = LeaveRequest(
      id: 'lv_${childId}_${DateTime.now().microsecondsSinceEpoch}',
      childId: childId,
      from: dateOnly(from),
      to: dateOnly(to),
      reason: reason.trim(),
      appliedOn: today(),
    );
    (_added[childId] ??= []).insert(0, r);
    _changes.add(null);
    return r;
  }
}
