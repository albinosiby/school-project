import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import '../config/app_config.dart';
import '../utils/services/cache_service.dart';
import '../utils/services/link_launcher.dart';
import '../utils/services/local_storage_service.dart';
import 'firebase_repositories.dart';
import 'modules/academics_di.dart';
import 'modules/auth_di.dart';
import 'modules/home_di.dart';
import 'modules/messages_di.dart';
import 'modules/profile_di.dart';
import 'modules/student_di.dart';

final GetIt getIt = GetIt.instance;

/// Registers services, repositories (interface -> implementation) and BLoCs.
/// [linkLauncher] lets tests replace `url_launcher`.
///
/// Backends: mock (local, default) and Firestore (`--dart-define=BACKEND=firebase`, see [registerFirebaseRepositories]).
/// BLoCs and screens only see the repository interfaces.
Future<void> configureDependencies({LinkLauncher? linkLauncher}) async {
  await getIt.reset();

  // === Shared services ===
  final storage = LocalStorageService();
  await storage.init();
  getIt.registerSingleton<LocalStorageService>(storage);
  getIt.registerSingleton<CacheService>(CacheService());
  getIt.registerSingleton<LinkLauncher>(
    linkLauncher ?? UrlLauncherLinkLauncher(),
  );

  // === Modules: repositories (interface -> implementation) + BLoCs ===
  // AppConfig.backend: local (default) uses the mock repositories; firebase replaces them below; rest has none yet.
  if (AppConfig.isRest) debugPrint('BACKEND=rest has no repositories yet: using the mock repositories.');
  registerAuthModule(getIt);
  registerAcademicsModule(getIt);
  registerHomeModule(getIt);
  registerMessagesModule(getIt);
  registerProfileModule(getIt);
  registerStudentModule(getIt);
  if (AppConfig.isFirebase) registerFirebaseRepositories(getIt);
}
