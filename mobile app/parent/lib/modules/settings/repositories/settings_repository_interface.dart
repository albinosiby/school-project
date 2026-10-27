import '../models/app_settings.dart';

abstract class ISettingsRepository {
  /// Current settings, then every saved change.
  Stream<AppSettings> watchSettings();
  Future<void> save(AppSettings settings);
}
