import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import '../config/app_config.dart';
import '../utils/services/cache_service.dart';
import '../utils/services/link_launcher.dart';
import '../utils/services/local_storage_service.dart';
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
/// Backends: only the mock (local) repositories exist today. When a REST or Firestore repository is added
/// (`<feature>_repository.dart` / `firebase_<feature>_repository.dart`), switch on [AppConfig] in the
/// matching `_register*` function below; BLoCs and screens do not change.
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
  // AppConfig.backend: local (default). rest / firebase fall back to the mock repositories until they exist.
  if (!AppConfig.isLocal)
    debugPrint(
      'BACKEND=${AppConfig.backend.name} has no repositories yet: using the mock repositories.',
    );
  registerAuthModule(getIt);
  registerAcademicsModule(getIt);
  registerHomeModule(getIt);
  registerMessagesModule(getIt);
  registerProfileModule(getIt);
  registerStudentModule(getIt);
}
