/// Where the repositories read and write data.
/// - [BackendType.local]: on-device JSON database (default; the app works fully offline with seed data)
/// - [BackendType.rest]: REST API via Dio (endpoints in constants/api_path.dart)
/// - [BackendType.firebase]: Firestore / Firebase Auth / Storage
enum BackendType { local, rest, firebase }

class AppConfig {
  AppConfig._();

  /// Override at build time: `flutter run --dart-define=BACKEND=rest|firebase`
  static const BackendType backend = _backendFromEnv;

  static const String _env = String.fromEnvironment(
    'BACKEND',
    defaultValue: 'local',
  );
  static const BackendType _backendFromEnv = _env == 'firebase'
      ? BackendType.firebase
      : _env == 'rest'
      ? BackendType.rest
      : BackendType.local;

  /// BACKEND=firebase against the local Firebase emulators (test builds): `--dart-define=EMULATOR=true`.
  static const bool useEmulator = bool.fromEnvironment('EMULATOR');
  /// Where the emulators run. On Android, FlutterFire maps `localhost` / `127.0.0.1` to `10.0.2.2` (the Android emulator's
  /// route to the computer), so a physical phone needs the computer's Wi-Fi address: `EMULATOR_HOST=192.168.x.x`.
  static const String emulatorHost = String.fromEnvironment('EMULATOR_HOST', defaultValue: '127.0.0.1');
  static const String emulatorProject = String.fromEnvironment('EMULATOR_PROJECT', defaultValue: 'demo-school-e2e');
  /// A USB phone tunnelled with `adb reverse tcp:8080 tcp:8080` and `adb reverse tcp:9099 tcp:9099`: keep 127.0.0.1 as is
  /// (`--dart-define=EMULATOR_USB=true`; FlutterFire otherwise rewrites it to 10.0.2.2, the Android emulator's route).
  static const bool emulatorUsb = bool.fromEnvironment('EMULATOR_USB');

  static bool get isLocal => backend == BackendType.local;
  static bool get isFirebase => backend == BackendType.firebase;
  static bool get isRest => backend == BackendType.rest;
}
