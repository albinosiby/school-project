import 'dart:async';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/local_storage_service.dart';
import '../models/app_settings.dart';
import 'settings_repository_interface.dart';

/// Settings persisted with [LocalStorageService] (SharedPreferences). Device-local by design, so this is
/// the implementation for every backend.
class LocalSettingsRepository implements ISettingsRepository {
  LocalSettingsRepository(this._storage, this._cache);
  final LocalStorageService _storage;
  final CacheService _cache;
  final _changes = StreamController<void>.broadcast();

  static const _prefix = 'settings_';
  static const _defaults = AppSettings();

  AppSettings _read() {
    bool b(String k, bool d) => _storage.getBool('$_prefix$k') ?? d;
    final lang = _storage.getString('${_prefix}language');
    return AppSettings(
      biometric: b('biometric', _defaults.biometric),
      push: b('push', _defaults.push),
      whatsapp: b('whatsapp', _defaults.whatsapp),
      sms: b('sms', _defaults.sms),
      digest: b('digest', _defaults.digest),
      language: AppLanguage.values.where((l) => l.name == lang).firstOrNull ??
          _defaults.language,
    );
  }

  @override
  Stream<AppSettings> watchSettings() => cacheFirst(
    cache: _cache,
    key: 'settings',
    fetch: () async => _read(),
    refreshOn: _changes.stream,
  );

  @override
  Future<void> save(AppSettings s) async {
    await Future.wait([
      _storage.setBool('${_prefix}biometric', s.biometric),
      _storage.setBool('${_prefix}push', s.push),
      _storage.setBool('${_prefix}whatsapp', s.whatsapp),
      _storage.setBool('${_prefix}sms', s.sms),
      _storage.setBool('${_prefix}digest', s.digest),
      _storage.setString('${_prefix}language', s.language.name),
    ]);
    _changes.add(null);
  }
}
