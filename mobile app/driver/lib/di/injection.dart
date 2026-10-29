import '../modules/transport/cubit/trip_session_cubit.dart';
import 'package:get_it/get_it.dart';
import '../modules/auth/repositories/auth_repository.dart';
import '../modules/auth/cubit/session_cubit.dart';
import '../modules/transport/repositories/trip_repository.dart';
import '../modules/account/repositories/account_view_repository.dart';
import '../modules/account/cubit/account_cubit.dart';
import '../modules/attendant/repositories/attendant_view_repository.dart';
import '../modules/attendant/cubit/attendant_cubit.dart';
import '../modules/auth/repositories/auth_view_repository.dart';
import '../modules/auth/cubit/auth_cubit.dart';
import '../modules/crew/repositories/crew_view_repository.dart';
import '../modules/crew/cubit/crew_cubit.dart';
import '../modules/learning/repositories/learning_view_repository.dart';
import '../modules/learning/cubit/learning_cubit.dart';
import '../modules/operations/repositories/operations_view_repository.dart';
import '../modules/operations/cubit/operations_cubit.dart';
import '../modules/transport/repositories/transport_view_repository.dart';
import '../modules/transport/cubit/transport_cubit.dart';

final getIt = GetIt.instance;
void configureDependencies() {
  if (getIt.isRegistered<SessionCubit>()) return;
  getIt.registerLazySingleton<AuthRepository>(DemoAuthRepository.new);
  getIt.registerLazySingleton(() => SessionCubit(getIt()));
  getIt.registerLazySingleton(() => TripSessionCubit(LocalTripRepository()));
  getIt.registerLazySingleton<TripRepository>(() => getIt<TripSessionCubit>());
  getIt.registerLazySingleton(AccountViewRepository.new);
  getIt.registerLazySingleton(AttendantViewRepository.new);
  getIt.registerLazySingleton(AuthViewRepository.new);
  getIt.registerLazySingleton(CrewViewRepository.new);
  getIt.registerLazySingleton(LearningViewRepository.new);
  getIt.registerLazySingleton(OperationsViewRepository.new);
  getIt.registerLazySingleton(TransportViewRepository.new);
  getIt.registerFactory(() => AuthCubit(getIt(), getIt()));
  getIt.registerFactory(() => CrewCubit(getIt(), getIt()));
  getIt.registerFactory(() => TransportCubit(getIt(), getIt()));
  getIt.registerFactory(() => OperationsCubit(getIt()));
  getIt.registerFactory(() => AccountCubit(getIt(), getIt(), clearSessionData));
  getIt.registerFactory(() => AttendantCubit(getIt(), getIt()));
  getIt.registerFactory(() => LearningCubit(getIt()));
}

void clearSessionData() {
  getIt<AccountViewRepository>().clear();
  getIt<AttendantViewRepository>().clear();
  getIt<AuthViewRepository>().clear();
  getIt<CrewViewRepository>().clear();
  getIt<LearningViewRepository>().clear();
  getIt<OperationsViewRepository>().clear();
  getIt<TransportViewRepository>().clear();
  getIt<TripRepository>().clear();
}
