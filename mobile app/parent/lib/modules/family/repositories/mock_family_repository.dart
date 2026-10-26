import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/family_models.dart';
import 'family_repository_interface.dart';

class MockFamilyRepository implements IFamilyRepository {
  MockFamilyRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<Family> watchFamily() => cacheFirst(
    cache: _cache,
    key: 'family',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.family;
    },
  );
}
