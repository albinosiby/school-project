import 'package:get_it/get_it.dart';
import '../../config/app_config.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/repositories/auth_repository_interface.dart';
import '../../modules/auth/repositories/firebase_auth_repository.dart';
import '../../modules/auth/repositories/local_auth_repository.dart';
import '../../utils/services/data_store.dart';
import '../../utils/services/firebase/firebase_auth_service.dart';
import '../../utils/services/firebase/firestore_data_store.dart';
import '../../utils/services/firebase/push_notification_service.dart';

/// Auth: Firebase login with the Firestore backend, otherwise the always-signed-in demo teacher.
void registerAuthModule(GetIt getIt) {
  getIt.registerLazySingleton<IAuthRepository>(() => AppConfig.isFirebase
      ? FirebaseAuthRepository(getIt<FirebaseAuthService>(), getIt<FirestoreDataStore>(), push: getIt<PushNotificationService>())
      : LocalAuthRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<AuthBloc>(() => AuthBloc(getIt<IAuthRepository>()));
}
