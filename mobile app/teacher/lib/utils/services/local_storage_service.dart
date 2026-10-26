import 'package:shared_preferences/shared_preferences.dart';
import '../../constants/app_constants.dart';

class LocalStorageService {
  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Generic getters/setters
  Future<void> setString(String key, String value) =>
      _prefs.setString(key, value);

  String? getString(String key) => _prefs.getString(key);

  Future<void> setBool(String key, bool value) => _prefs.setBool(key, value);

  bool? getBool(String key) => _prefs.getBool(key);

  Future<void> setInt(String key, int value) => _prefs.setInt(key, value);

  int? getInt(String key) => _prefs.getInt(key);

  Future<void> remove(String key) => _prefs.remove(key);

  Future<void> clear() => _prefs.clear();

  // Convenience: Onboarding
  bool get isOnboardingComplete =>
      _prefs.getBool(AppConstants.onboardingKey) ?? false;

  Future<void> setOnboardingComplete() =>
      _prefs.setBool(AppConstants.onboardingKey, true);

  // Convenience: Theme
  String? get savedThemeMode => _prefs.getString(AppConstants.themeKey);

  Future<void> setThemeMode(String mode) =>
      _prefs.setString(AppConstants.themeKey, mode);
}
