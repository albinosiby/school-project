import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/homework_models.dart';
import 'homework_repository_interface.dart';

class MockHomeworkRepository implements IHomeworkRepository {
  MockHomeworkRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<List<Homework>> watchHomework(String childId) => cacheFirst(
    cache: _cache,
    key: 'homework:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.homework(childId);
    },
  );
}
