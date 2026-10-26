import '../../../constants/app_constants.dart';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/local_storage_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../../family/models/family_models.dart';
import 'auth_repository_interface.dart';

/// Accepts the demo guardian only ([DemoData.demoEmail] / [DemoData.demoPassword]); the session is kept in local storage.
class MockAuthRepository implements IAuthRepository {
  MockAuthRepository(this._storage);
  final LocalStorageService _storage;

  @override
  Future<Guardian> login(String email, String password) async {
    await MockLatency.wait();
    if (email.trim().toLowerCase() != DemoData.demoEmail ||
        password != DemoData.demoPassword) {
      throw AppException(
        message: 'Incorrect email or password.',
        statusCode: 401,
      );
    }
    await _storage.setString(AppConstants.sessionKey, DemoData.guardian.id);
    return DemoData.guardian;
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    await MockLatency.wait();
    if (!email.contains('@'))
      throw AppException(message: 'Enter a valid email address.');
  }

  @override
  Future<Guardian?> currentGuardian() async =>
      _storage.getString(AppConstants.sessionKey) == DemoData.guardian.id
      ? DemoData.guardian
      : null;

  @override
  Future<void> logout() => _storage.remove(AppConstants.sessionKey);
}
