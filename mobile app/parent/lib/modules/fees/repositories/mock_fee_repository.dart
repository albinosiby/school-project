import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/fee_models.dart';
import 'fee_repository_interface.dart';

class MockFeeRepository implements IFeeRepository {
  MockFeeRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<FeesData> watchFees(String childId) => cacheFirst(
    cache: _cache,
    key: 'fee:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.fees(childId);
    },
  );
}
