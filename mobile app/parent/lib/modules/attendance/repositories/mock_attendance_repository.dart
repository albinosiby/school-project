import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/attendance_models.dart';
import 'attendance_repository_interface.dart';

class MockAttendanceRepository implements IAttendanceRepository {
  MockAttendanceRepository(this._cache);
  final CacheService _cache;

  @override
  Stream<AttendanceData> watchAttendance(String childId) => cacheFirst(
    cache: _cache,
    key: 'attendance:$childId',
    fetch: () async {
      await MockLatency.wait();
      return DemoData.attendance(childId);
    },
  );
}
