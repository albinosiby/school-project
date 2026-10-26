import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/guardian_profile.dart';
import 'profile_repository_interface.dart';

/// In-memory guardian profile seeded from [DemoData.guardian]; edits last until the app restarts.
class MockProfileRepository implements IProfileRepository {
  MockProfileRepository(this._cache);
  final CacheService _cache;
  final _changes = StreamController<void>.broadcast();

  GuardianProfile _profile = const GuardianProfile(
    guardian: DemoData.guardian,
    parentId: 'GIS-PAR-0001',
    address: 'B-402, Nirvana Country, Sector 50, Gurugram, Haryana - 122018',
    emergencyName: 'Mrs. Priya Sharma',
    emergencyRelation: 'Spouse',
    emergencyPhone: '+91 98110 33819',
    photoStyle: 0,
  );

  @override
  Stream<GuardianProfile> watchProfile() => cacheFirst(
    cache: _cache,
    key: 'profile',
    fetch: () async {
      await MockLatency.wait();
      return _profile;
    },
    refetch: () async => _profile,
    refreshOn: _changes.stream,
  );

  @override
  Future<void> updateProfile(GuardianProfile profile) async {
    await MockLatency.wait();
    if (profile.guardian.id != _profile.guardian.id) {
      throw AppException(message: 'This profile belongs to another account.');
    }
    _profile = profile.copyWith(
      phoneVerified:
          profile.guardian.phone == _profile.guardian.phone && _profile.phoneVerified,
    );
    _changes.add(null);
  }

  @override
  Future<void> setPhoto(int? style) async {
    await MockLatency.wait();
    _profile = _profile.copyWith(photoStyle: () => style);
    _changes.add(null);
  }
}
