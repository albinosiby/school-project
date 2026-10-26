import '../models/home_models.dart';

/// App preferences (settings screen) and the last sync time shown on Home.
abstract class ISettingsRepository {
  Future<AppSettings> get();
  Future<void> save(AppSettings settings);
  /// Syncs with the school server (simulated) and stores the sync time.
  Future<void> sync();
  Stream<void> watch();
}
