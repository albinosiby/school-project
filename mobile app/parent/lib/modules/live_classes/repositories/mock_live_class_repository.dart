import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/live_class_models.dart';
import 'live_class_repository_interface.dart';

class MockLiveClassRepository implements ILiveClassRepository {
  MockLiveClassRepository(this._cache);
  final CacheService _cache;

  /// Class ids whose link was opened (inspectable in tests).
  final Set<String> joins = {};

  @override
  Stream<List<LiveClass>> watchLiveClasses(String childId) => cacheFirst(
    cache: _cache,
    key: 'live:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.liveClasses(childId);
    },
  );

  @override
  Future<void> recordJoin(String classId) async => joins.add(classId);
}
