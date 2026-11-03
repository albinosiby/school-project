/// Where the repositories read and write data.
/// - [BackendType.local]: on-device JSON database (default; the app works fully offline with seed data)
/// - [BackendType.rest]: REST API via Dio (endpoints in constants/api_path.dart)
/// - [BackendType.firebase]: Firestore / Firebase Auth / Storage
enum BackendType { local, rest, firebase }

class AppConfig {
  AppConfig._();

  /// Override at build time: `flutter run --dart-define=BACKEND=rest|firebase`
  static const BackendType backend = _backendFromEnv;

  static const String _env = String.fromEnvironment('BACKEND', defaultValue: 'local');
  static const BackendType _backendFromEnv = _env == 'firebase'
      ? BackendType.firebase
      : _env == 'rest'
          ? BackendType.rest
          : BackendType.local;

  /// "Create Google Meet" + Google Calendar in the live-class form (Meet REST API / Calendar API on the teacher's Google
  /// account). Off until the OAuth consent screen is set up; teachers paste a Meet link instead.
  /// Turn on with `--dart-define=GOOGLE_MEET=true`.
  static const bool googleMeetIntegration = bool.fromEnvironment('GOOGLE_MEET');

  /// BACKEND=firebase against the local Firebase emulators (test builds only): `--dart-define=EMULATOR=true`.
  static const bool useEmulator = bool.fromEnvironment('EMULATOR');
  static const String emulatorHost = String.fromEnvironment('EMULATOR_HOST', defaultValue: '127.0.0.1');
  static const String emulatorProject = String.fromEnvironment('EMULATOR_PROJECT', defaultValue: 'demo-school-e2e');

  /// A USB phone tunnelled with `adb reverse tcp:8080 tcp:8080` / `tcp:9099` / `tcp:9199`: keep 127.0.0.1 as is
  /// (`--dart-define=EMULATOR_USB=true`; FlutterFire otherwise rewrites it to 10.0.2.2, the Android emulator's route).
  static const bool emulatorUsb = bool.fromEnvironment('EMULATOR_USB');

  static bool get isLocal => backend == BackendType.local;
  static bool get isFirebase => backend == BackendType.firebase;
  static bool get isRest => backend == BackendType.rest;
}
