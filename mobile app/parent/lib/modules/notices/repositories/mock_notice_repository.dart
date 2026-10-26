import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/notice_models.dart';
import 'notice_repository_interface.dart';

class MockNoticeRepository implements INoticeRepository {
  MockNoticeRepository(this._cache);
  final CacheService _cache;
  final Set<String> _acked = {};
  final _changes = StreamController<void>.broadcast();

  List<Notice> _build(String childId) => [
    for (final n in DemoData.notices(childId))
      _acked.contains(n.id) ? n.acknowledge() : n,
  ];

  @override
  Stream<List<Notice>> watchNotices(String childId) => cacheFirst(
    cache: _cache,
    key: 'notices:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _build(childId);
    },
    refetch: () async => _build(childId),
    refreshOn: _changes.stream,
  );

  @override
  Future<void> acknowledge(String noticeId) async {
    await MockLatency.wait();
    _acked.add(noticeId);
    _changes.add(null);
  }
}
