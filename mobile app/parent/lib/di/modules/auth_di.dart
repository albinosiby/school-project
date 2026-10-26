import 'package:get_it/get_it.dart';
import '../../utils/services/cache_service.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/bloc/registration_bloc.dart';
import '../../modules/auth/repositories/auth_repository_interface.dart';
import '../../modules/auth/repositories/mock_auth_repository.dart';
import '../../modules/auth/repositories/mock_registration_repository.dart';
import '../../modules/auth/repositories/registration_repository_interface.dart';
import '../../modules/family/bloc/family_bloc.dart';
import '../../modules/family/repositories/family_repository_interface.dart';
import '../../modules/family/repositories/mock_family_repository.dart';

/// Registers the auth modules' repositories (interface -> implementation) and BLoCs.
/// Backend switch: choose the implementation with AppConfig here (mock today).
void registerAuthModule(GetIt getIt) {
  getIt.registerLazySingleton<IAuthRepository>(
    () => MockAuthRepository(getIt()),
  );
  getIt.registerLazySingleton<IRegistrationRepository>(
    () => MockRegistrationRepository(),
  );
  getIt.registerLazySingleton<IFamilyRepository>(
    () => MockFamilyRepository(getIt<CacheService>()),
  );
  getIt.registerLazySingleton<AuthBloc>(() => AuthBloc(getIt()));
  getIt.registerLazySingleton<FamilyBloc>(() => FamilyBloc(getIt()));
  getIt.registerFactory<RegistrationBloc>(() => RegistrationBloc(getIt()));
}
