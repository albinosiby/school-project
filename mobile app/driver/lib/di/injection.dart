import 'package:get_it/get_it.dart';
import '../config/app_config.dart';
import '../modules/attendance/bloc/attendance_bloc.dart';
import '../modules/attendance/repositories/attendance_repository_interface.dart';
import '../modules/auth/bloc/auth_bloc.dart';
import '../modules/auth/repositories/auth_repository_interface.dart';
import '../modules/crew/bloc/crew_bloc.dart';
import '../modules/crew/bloc/profile_bloc.dart';
import '../modules/crew/repositories/crew_repository_interface.dart';
import '../modules/crew_attendance/bloc/crew_attendance_bloc.dart';
import '../modules/crew_attendance/repositories/crew_attendance_repository_interface.dart';
import '../modules/leave/bloc/leave_bloc.dart';
import '../modules/leave/repositories/leave_repository_interface.dart';
import '../modules/notices/bloc/notices_bloc.dart';
import '../modules/notices/repositories/notice_repository_interface.dart';
import '../modules/students/bloc/roster_bloc.dart';
import '../modules/students/repositories/student_repository_interface.dart';
import '../modules/trips/bloc/trips_bloc.dart';
import '../modules/trips/models/trip_models.dart';
import '../modules/trips/repositories/trip_repository_interface.dart';
import '../utils/services/cache_service.dart';
import '../utils/services/link_launcher.dart';
import '../utils/services/local_storage_service.dart';
import 'demo_data.dart';
import 'firebase_repositories.dart';
import 'mock_repositories.dart';

final GetIt getIt = GetIt.instance;

/// Registers services, repositories (interface -> implementation) and BLoCs.
/// Backends: local demo (default) and Firestore (`--dart-define=BACKEND=firebase`, see [registerFirebaseRepositories]).
/// [linkLauncher] lets tests replace `url_launcher`; [store] lets tests seed the demo school.
Future<void> configureDependencies({LinkLauncher? linkLauncher, DemoStore? store}) async {
  await getIt.reset();

  final storage = LocalStorageService();
  await storage.init();
  getIt.registerSingleton<LocalStorageService>(storage);
  getIt.registerSingleton<CacheService>(CacheService());
  getIt.registerSingleton<LinkLauncher>(linkLauncher ?? UrlLauncherLinkLauncher());

  if (AppConfig.isFirebase) {
    registerFirebaseRepositories(getIt);
  } else {
    final demo = store ?? DemoStore();
    final session = MockSession(demo);
    getIt.registerSingleton<DemoStore>(demo);
    getIt.registerSingleton<MockSession>(session);
    getIt.registerLazySingleton<IAuthRepository>(() => MockAuthRepository(session, getIt()));
    getIt.registerLazySingleton<ICrewRepository>(() => MockCrewRepository(session, getIt()));
    getIt.registerLazySingleton<IStudentRepository>(() => MockStudentRepository(session, getIt()));
    getIt.registerLazySingleton<ITripRepository>(() => MockTripRepository(session, getIt()));
    getIt.registerLazySingleton<IAttendanceRepository>(() => MockAttendanceRepository(session, getIt()));
    getIt.registerLazySingleton<ICrewAttendanceRepository>(() => MockCrewAttendanceRepository(session, getIt()));
    getIt.registerLazySingleton<ILeaveRepository>(() => MockLeaveRepository(session, getIt()));
    getIt.registerLazySingleton<INoticeRepository>(() => MockNoticeRepository(session, getIt()));
  }

  // BLoCs: global singletons (auth, crew context) and factories for screen-scoped ones
  getIt.registerLazySingleton<AuthBloc>(() => AuthBloc(getIt()));
  getIt.registerLazySingleton<CrewBloc>(() => CrewBloc(getIt()));
  getIt.registerFactory<RosterBloc>(() => RosterBloc(getIt()));
  getIt.registerFactory<DayTripsBloc>(() => DayTripsBloc(getIt()));
  getIt.registerFactory<TripHistoryBloc>(() => TripHistoryBloc(getIt()));
  getIt.registerFactory<TripActionBloc>(() => TripActionBloc(getIt()));
  getIt.registerFactoryParam<AttendanceBloc, Trip, void>((trip, _) => AttendanceBloc(getIt(), trip));
  getIt.registerFactory<BusAttendanceHistoryBloc>(() => BusAttendanceHistoryBloc(getIt()));
  getIt.registerFactory<CrewAttendanceBloc>(() => CrewAttendanceBloc(getIt()));
  getIt.registerFactory<PunchBloc>(() => PunchBloc(getIt()));
  getIt.registerFactory<LeavesBloc>(() => LeavesBloc(getIt()));
  getIt.registerFactory<LeaveFormBloc>(() => LeaveFormBloc(getIt()));
  getIt.registerFactory<NoticesBloc>(() => NoticesBloc(getIt()));
  getIt.registerFactory<ProfileFormBloc>(() => ProfileFormBloc(getIt()));
}

/// Forget cached data of the previous crew member (sign-out, role change).
void clearSessionData() {
  getIt<CacheService>().clear();
  if (getIt.isRegistered<CrewBloc>()) {
    getIt.unregister<CrewBloc>();
    getIt.registerLazySingleton<CrewBloc>(() => CrewBloc(getIt()));
  }
}
