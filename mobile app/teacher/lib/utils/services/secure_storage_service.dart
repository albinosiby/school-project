import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../constants/app_constants.dart';

class SecureStorageService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Auth token
  Future<void> saveToken(String token) =>
      _storage.write(key: AppConstants.tokenKey, value: token);

  Future<String?> getToken() => _storage.read(key: AppConstants.tokenKey);

  Future<void> deleteToken() => _storage.delete(key: AppConstants.tokenKey);

  // Refresh token
  Future<void> saveRefreshToken(String token) =>
      _storage.write(key: AppConstants.refreshTokenKey, value: token);

  Future<String?> getRefreshToken() =>
      _storage.read(key: AppConstants.refreshTokenKey);

  Future<void> deleteRefreshToken() =>
      _storage.delete(key: AppConstants.refreshTokenKey);

  // Clear all
  Future<void> clearAll() => _storage.deleteAll();
}
