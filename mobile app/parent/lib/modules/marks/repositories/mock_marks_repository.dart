import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/marks_models.dart';
import 'marks_repository_interface.dart';

class MockMarksRepository implements IMarksRepository {
  MockMarksRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<List<ExamResult>> watchExams(String childId) => cacheFirst(
    cache: _cache,
    key: 'marks:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.exams(childId);
    },
  );
}
