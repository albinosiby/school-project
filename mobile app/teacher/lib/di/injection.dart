import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import '../config/app_config.dart';
import '../utils/services/firebase/firebase_auth_service.dart';
import '../utils/services/firebase/push_notification_service.dart';
import '../utils/services/firebase/firebase_storage_service.dart';
import '../utils/services/firebase/firestore_data_store.dart';
import '../utils/services/firebase/firestore_service.dart';
import '../utils/services/firebase/remote_gateway.dart';
import '../utils/services/local_database_service.dart';
import '../utils/services/local_storage_service.dart';
import '../utils/services/native_api_service.dart';
import '../utils/services/rest_api_service.dart';
import '../utils/services/secure_storage_service.dart';
import 'modules/attendance_di.dart';
import 'modules/auth_di.dart';
import 'modules/classes_di.dart';
import 'modules/engage_di.dart';
import 'modules/home_di.dart';
import 'modules/lessons_di.dart';
import 'modules/school_di.dart';
import 'modules/tasks_di.dart';
import 'seed_data.dart';

final GetIt getIt = GetIt.instance;

/// [db] lets tests inject an in-memory database. With `BACKEND=firebase` the repositories read and write the
/// [FirestoreDataStore] instead (started after login by the auth repository); otherwise the local database.
Future<void> configureDependencies({LocalDatabaseService? db}) async {
  await getIt.reset();

  // === Shared services ===
  final storage = LocalStorageService();
  await storage.init();
  getIt.registerSingleton<LocalStorageService>(storage);
  if (AppConfig.isFirebase && db == null) {
    final store = FirestoreDataStore(FirestoreGateway(), onError: (e, s) => debugPrint('Firestore: $e'));
    getIt.registerSingleton<FirestoreDataStore>(store);
    getIt.registerSingleton<DataStore>(store);
  } else {
    final local = db ?? await LocalDatabaseService.open(buildSeed());
    getIt.registerSingleton<LocalDatabaseService>(local);
    getIt.registerSingleton<DataStore>(local);
  }
  getIt.registerLazySingleton<SecureStorageService>(() => SecureStorageService());
  getIt.registerLazySingleton<NativeApiService>(() => NativeApiService());

  // === Backend services (repositories currently use the local backend) ===
  if (AppConfig.isRest) getIt.registerLazySingleton<RestApiService>(() => RestApiService(getIt<SecureStorageService>()));
  if (AppConfig.isFirebase) {
    getIt.registerLazySingleton<FirebaseAuthService>(() => FirebaseAuthService());
    getIt.registerLazySingleton<PushNotificationService>(() => PushNotificationService());
    getIt.registerLazySingleton<FirestoreService>(() => FirestoreService());
    getIt.registerLazySingleton<FirebaseStorageService>(() => FirebaseStorageService());
  }

  // === Modules: repositories (interface -> implementation) + BLoCs ===
  registerAuthModule(getIt);
  registerSchoolModule(getIt);
  registerHomeModule(getIt);
  registerClassesModule(getIt);
  registerTasksModule(getIt);
  registerAttendanceModule(getIt);
  registerLessonsModule(getIt);
  registerEngageModule(getIt);
}
