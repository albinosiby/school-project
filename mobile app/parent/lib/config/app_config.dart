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

  static bool get isLocal => backend == BackendType.local;
  static bool get isFirebase => backend == BackendType.firebase;
  static bool get isRest => backend == BackendType.rest;
}
