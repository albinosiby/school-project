import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import '../config/app_config.dart';
import '../modules/attendance/bloc/attendance_bloc.dart';
import '../modules/attendance/repositories/attendance_repository_interface.dart';
import '../modules/attendance/repositories/mock_attendance_repository.dart';
import '../modules/auth/bloc/auth_bloc.dart';
import '../modules/auth/repositories/auth_repository_interface.dart';
import '../modules/auth/repositories/mock_auth_repository.dart';
import '../modules/family/bloc/family_bloc.dart';
import '../modules/family/repositories/family_repository_interface.dart';
import '../modules/family/repositories/mock_family_repository.dart';
import '../modules/fees/bloc/fees_bloc.dart';
import '../modules/fees/repositories/fee_repository_interface.dart';
import '../modules/fees/repositories/mock_fee_repository.dart';
import '../modules/home/bloc/home_bloc.dart';
import '../modules/home/repositories/home_repository.dart';
import '../modules/home/repositories/home_repository_interface.dart';
import '../modules/homework/bloc/homework_bloc.dart';
import '../modules/homework/repositories/homework_repository_interface.dart';
import '../modules/homework/repositories/mock_homework_repository.dart';
import '../modules/leave/bloc/leave_apply_bloc.dart';
import '../modules/leave/bloc/leave_bloc.dart';
import '../modules/leave/repositories/leave_repository_interface.dart';
import '../modules/leave/repositories/mock_leave_repository.dart';
import '../modules/live_classes/bloc/live_classes_bloc.dart';
import '../modules/live_classes/repositories/live_class_repository_interface.dart';
import '../modules/live_classes/repositories/mock_live_class_repository.dart';
import '../modules/marks/bloc/marks_bloc.dart';
import '../modules/marks/repositories/marks_repository_interface.dart';
import '../modules/marks/repositories/mock_marks_repository.dart';
import '../modules/messages/bloc/chat_bloc.dart';
import '../modules/messages/bloc/threads_bloc.dart';
import '../modules/messages/repositories/message_repository_interface.dart';
import '../modules/messages/repositories/mock_message_repository.dart';
import '../modules/notices/bloc/notices_bloc.dart';
import '../modules/notices/repositories/mock_notice_repository.dart';
import '../modules/notices/repositories/notice_repository_interface.dart';
import '../modules/timetable/bloc/timetable_bloc.dart';
import '../modules/timetable/repositories/mock_timetable_repository.dart';
import '../modules/timetable/repositories/timetable_repository_interface.dart';
import '../utils/services/cache_service.dart';
import '../utils/services/link_launcher.dart';
import '../utils/services/local_storage_service.dart';

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

  // === Repositories ===
  _registerRepositories();

  // === BLoCs ===
  getIt.registerLazySingleton<AuthBloc>(() => AuthBloc(getIt()));
  getIt.registerLazySingleton<FamilyBloc>(() => FamilyBloc(getIt()));
  getIt.registerFactory<HomeBloc>(() => HomeBloc(getIt()));
  getIt.registerFactory<AttendanceBloc>(() => AttendanceBloc(getIt()));
  getIt.registerFactory<HomeworkBloc>(() => HomeworkBloc(getIt()));
  getIt.registerFactory<MarksBloc>(() => MarksBloc(getIt()));
  getIt.registerFactory<TimetableBloc>(() => TimetableBloc(getIt()));
  getIt.registerFactory<NoticesBloc>(() => NoticesBloc(getIt()));
  getIt.registerFactory<LiveClassesBloc>(() => LiveClassesBloc(getIt()));
  getIt.registerFactory<LeaveBloc>(() => LeaveBloc(getIt()));
  getIt.registerFactory<LeaveApplyBloc>(() => LeaveApplyBloc(getIt()));
  getIt.registerFactory<ThreadsBloc>(() => ThreadsBloc(getIt()));
  getIt.registerFactory<ChatBloc>(() => ChatBloc(getIt()));
  getIt.registerFactory<FeesBloc>(() => FeesBloc(getIt()));
}

void _registerRepositories() {
  final cache = getIt<CacheService>();
  // AppConfig.backend: local (default). rest / firebase fall back to the mock until their repositories exist.
  if (!AppConfig.isLocal)
    debugPrint(
      'BACKEND=${AppConfig.backend.name} has no repositories yet: using the mock repositories.',
    );
  getIt.registerSingleton<IAuthRepository>(MockAuthRepository(getIt()));
  getIt.registerSingleton<IFamilyRepository>(MockFamilyRepository(cache));
  getIt.registerSingleton<IAttendanceRepository>(
    MockAttendanceRepository(cache),
  );
  getIt.registerSingleton<IHomeworkRepository>(MockHomeworkRepository(cache));
  getIt.registerSingleton<IMarksRepository>(MockMarksRepository(cache));
  getIt.registerSingleton<ITimetableRepository>(MockTimetableRepository(cache));
  getIt.registerSingleton<INoticeRepository>(MockNoticeRepository(cache));
  getIt.registerSingleton<ILiveClassRepository>(MockLiveClassRepository(cache));
  getIt.registerSingleton<ILeaveRepository>(MockLeaveRepository(cache));
  getIt.registerSingleton<IMessageRepository>(MockMessageRepository(cache));
  getIt.registerSingleton<IFeeRepository>(MockFeeRepository(cache));
  // Home composes the other repositories, so it is backend-agnostic.
  getIt.registerSingleton<IHomeRepository>(
    HomeRepository(
      cache: cache,
      timetable: getIt(),
      attendance: getIt(),
      homework: getIt(),
      notices: getIt(),
      liveClasses: getIt(),
    ),
  );
}
