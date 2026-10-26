import '../../../utils/services/data_store.dart';
import '../models/home_models.dart';
import 'settings_repository_interface.dart';

class LocalSettingsRepository implements ISettingsRepository {
  LocalSettingsRepository(this._db, {this.syncDelay = const Duration(milliseconds: 700)});
  final DataStore _db;
  final Duration syncDelay;
  static const _c = 'settings';

  @override
  Future<AppSettings> get() async => AppSettings.fromJson(_db.doc(_c));

  @override
  Future<void> save(AppSettings settings) async => _db.setDoc(_c, settings.toJson());

  @override
  Future<void> sync() async {
    await Future<void>.delayed(syncDelay); // simulated network round trip
    _db.setDoc(_c, {'lastSync': DateTime.now().toIso8601String()});
  }

  @override
  Stream<void> watch() => _db.watch({_c});
}
