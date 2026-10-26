import 'package:get_it/get_it.dart';
import '../../modules/attendance/repositories/attendance_repository_interface.dart';
import '../../modules/home/bloc/home_bloc.dart';
import '../../modules/home/bloc/notifications_bloc.dart';
import '../../modules/home/bloc/profile_bloc.dart';
import '../../modules/home/bloc/settings_bloc.dart';
import '../../modules/home/bloc/substitution_bloc.dart';
import '../../modules/home/bloc/timetable_bloc.dart';
import '../../modules/home/repositories/home_repository.dart';
import '../../modules/home/repositories/home_repository_interface.dart';
import '../../modules/home/repositories/notification_repository.dart';
import '../../modules/home/repositories/notification_repository_interface.dart';
import '../../modules/home/repositories/profile_repository.dart';
import '../../modules/home/repositories/profile_repository_interface.dart';
import '../../modules/home/repositories/settings_repository.dart';
import '../../modules/home/repositories/settings_repository_interface.dart';
import '../../modules/home/repositories/timetable_repository.dart';
import '../../modules/home/repositories/timetable_repository_interface.dart';
import '../../utils/services/data_store.dart';

/// Registers the home module's repositories (interface -> implementation) and BLoCs.
void registerHomeModule(GetIt getIt) {
  // Repositories
  getIt.registerLazySingleton<INotificationRepository>(() => LocalNotificationRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IHomeRepository>(() => LocalHomeRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ITimetableRepository>(() => LocalTimetableRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ISettingsRepository>(() => LocalSettingsRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IProfileRepository>(() => LocalProfileRepository(getIt<DataStore>()));

  // BLoCs
  getIt.registerFactory<NotificationsBloc>(() => NotificationsBloc(getIt<INotificationRepository>()));
  getIt.registerFactory<HomeBloc>(() => HomeBloc(getIt<IHomeRepository>(), getIt<ITimetableRepository>(), getIt<ISettingsRepository>(), getIt<IAttendanceRepository>()));
  getIt.registerFactory<TimetableBloc>(() => TimetableBloc(getIt<ITimetableRepository>(), getIt<ISettingsRepository>()));
  getIt.registerFactory<SubstitutionBloc>(() => SubstitutionBloc(getIt<ITimetableRepository>()));
  getIt.registerFactory<ProfileBloc>(() => ProfileBloc(getIt<IProfileRepository>()));
  getIt.registerFactory<SettingsBloc>(() => SettingsBloc(getIt<ISettingsRepository>()));
}
