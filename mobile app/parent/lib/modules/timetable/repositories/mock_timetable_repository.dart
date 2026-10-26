import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/timetable_models.dart';
import 'timetable_repository_interface.dart';

class MockTimetableRepository implements ITimetableRepository {
  MockTimetableRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<TimetableWeek> watchWeek(String childId) => cacheFirst(
    cache: _cache,
    key: 'timetable:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.timetable(childId);
    },
  );
}
