import 'package:get_it/get_it.dart';
import '../../modules/family/repositories/family_repository_interface.dart';
import '../../modules/notices/bloc/notices_bloc.dart';
import '../../modules/notices/repositories/mock_notice_repository.dart';
import '../../modules/notices/repositories/notice_repository_interface.dart';
import '../../modules/notifications/bloc/notifications_bloc.dart';
import '../../modules/notifications/repositories/mock_notification_repository.dart';
import '../../modules/notifications/repositories/notification_repository_interface.dart';
import '../../modules/profile/bloc/profile_bloc.dart';
import '../../modules/profile/repositories/mock_profile_repository.dart';
import '../../modules/profile/repositories/profile_family_repository.dart';
import '../../modules/profile/repositories/profile_repository_interface.dart';
import '../../modules/settings/bloc/settings_bloc.dart';
import '../../modules/settings/repositories/local_settings_repository.dart';
import '../../modules/settings/repositories/settings_repository_interface.dart';
import '../../utils/services/cache_service.dart';

/// Registers the profile, settings, notices and notifications modules (interface -> implementation) and BLoCs.
/// Backend switch: choose the implementation with AppConfig here (mock today; settings are device-local).
/// Must run after registerAuthModule (it decorates IFamilyRepository).
void registerProfileModule(GetIt getIt) {
  getIt.registerLazySingleton<INoticeRepository>(
    () => MockNoticeRepository(getIt<CacheService>()),
  );
  getIt.registerFactory<NoticesBloc>(() => NoticesBloc(getIt()));

  getIt.registerLazySingleton<INotificationRepository>(
    () => MockNotificationRepository(getIt<CacheService>(), getIt()),
  );
  // Global: header bell unread dot + notification centre. Lead: also provide it in di/global_blocs.dart.
  getIt.registerLazySingleton<NotificationsBloc>(() => NotificationsBloc(getIt()));

  getIt.registerLazySingleton<IProfileRepository>(
    () => MockProfileRepository(getIt<CacheService>()),
  );
  getIt.registerFactory<ProfileBloc>(() => ProfileBloc(getIt(), getIt()));

  // Saved guardian edits flow into the family stream (FamilyBloc) through this decorator.
  if (getIt.isRegistered<IFamilyRepository>()) {
    final base = getIt<IFamilyRepository>();
    getIt.unregister<IFamilyRepository>();
    getIt.registerLazySingleton<IFamilyRepository>(
      () => ProfileFamilyRepository(base, getIt()),
    );
  }

  getIt.registerLazySingleton<ISettingsRepository>(
    () => LocalSettingsRepository(getIt(), getIt<CacheService>()),
  );
  getIt.registerFactory<SettingsBloc>(() => SettingsBloc(getIt()));
}
