/// Where the repositories read and write data.
/// - [BackendType.local]: in-memory demo data (default; the app works fully offline)
/// - [BackendType.firebase]: Firestore / Firebase Auth shared with the admin web (data contract section 14)
enum BackendType { local, firebase }

class AppConfig {
  AppConfig._();

  /// Override at build time: `flutter run --dart-define=BACKEND=firebase`
  static const BackendType backend = _env == 'firebase' ? BackendType.firebase : BackendType.local;
  static const String _env = String.fromEnvironment('BACKEND', defaultValue: 'local');

  /// BACKEND=firebase against the local Firebase emulators (test builds): `--dart-define=EMULATOR=true`.
  static const bool useEmulator = bool.fromEnvironment('EMULATOR');

  /// Where the emulators run. On Android, FlutterFire maps `localhost` / `127.0.0.1` to `10.0.2.2` (the Android emulator's
  /// route to the computer), so a physical phone needs the computer's Wi-Fi address: `EMULATOR_HOST=192.168.x.x`.
  static const String emulatorHost = String.fromEnvironment('EMULATOR_HOST', defaultValue: '127.0.0.1');
  static const String emulatorProject = String.fromEnvironment('EMULATOR_PROJECT', defaultValue: 'demo-school-e2e');

  static bool get isLocal => backend == BackendType.local;
  static bool get isFirebase => backend == BackendType.firebase;
}
