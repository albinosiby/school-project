import 'package:get_it/get_it.dart';
import '../../modules/lessons/bloc/certificates_bloc.dart';
import '../../modules/lessons/bloc/lesson_plans_bloc.dart';
import '../../modules/lessons/bloc/online_tests_bloc.dart';
import '../../modules/lessons/repositories/certificate_repository.dart';
import '../../modules/lessons/repositories/certificate_repository_interface.dart';
import '../../modules/lessons/repositories/lesson_plan_repository.dart';
import '../../modules/lessons/repositories/lesson_plan_repository_interface.dart';
import '../../modules/lessons/repositories/online_test_repository.dart';
import '../../modules/lessons/repositories/online_test_repository_interface.dart';
import '../../modules/more/bloc/more_bloc.dart';
import '../../modules/more/repositories/more_repository.dart';
import '../../modules/more/repositories/more_repository_interface.dart';
import '../../utils/services/data_store.dart';

/// Registers the lessons module (lesson plans, online tests, certificates) and the More hub.
void registerLessonsModule(GetIt getIt) {
  getIt.registerLazySingleton<ILessonPlanRepository>(() => LocalLessonPlanRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IOnlineTestRepository>(() => LocalOnlineTestRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ICertificateRepository>(() => LocalCertificateRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IMoreRepository>(() => LocalMoreRepository(getIt<DataStore>()));

  getIt.registerFactory<LessonPlansBloc>(() => LessonPlansBloc(getIt<ILessonPlanRepository>()));
  getIt.registerFactory<OnlineTestsBloc>(() => OnlineTestsBloc(getIt<IOnlineTestRepository>()));
  getIt.registerFactory<CertificatesBloc>(() => CertificatesBloc(getIt<ICertificateRepository>()));
  getIt.registerFactory<MoreBloc>(() => MoreBloc(getIt<IMoreRepository>()));
}
