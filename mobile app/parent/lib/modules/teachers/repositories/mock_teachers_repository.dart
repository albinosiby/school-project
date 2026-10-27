import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/teacher_models.dart';
import 'teachers_demo_data.dart';
import 'teachers_repository_interface.dart';

class MockTeachersRepository implements ITeachersRepository {
  MockTeachersRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<TeachersData> watchTeachers(String childId) => cacheFirst(
    cache: _cache,
    key: 'teachers:$childId',
    fetch: () async {
      await MockLatency.wait();
      return TeachersDemoData.forChild(childId);
    },
  );
}
