import 'package:get_it/get_it.dart';
import '../../utils/services/cache_service.dart';
import '../../modules/behaviour/bloc/behaviour_bloc.dart';
import '../../modules/behaviour/repositories/behaviour_repository_interface.dart';
import '../../modules/behaviour/repositories/mock_behaviour_repository.dart';
import '../../modules/home/bloc/home_bloc.dart';
import '../../modules/home/repositories/home_repository.dart';
import '../../modules/home/repositories/home_repository_interface.dart';
import '../../modules/leave/bloc/leave_apply_bloc.dart';
import '../../modules/leave/bloc/leave_bloc.dart';
import '../../modules/leave/bloc/leave_overview_bloc.dart';
import '../../modules/leave/repositories/leave_repository_interface.dart';
import '../../modules/leave/repositories/mock_leave_repository.dart';
import '../../modules/live_classes/bloc/live_classes_bloc.dart';
import '../../modules/live_classes/repositories/live_class_repository_interface.dart';
import '../../modules/live_classes/repositories/mock_live_class_repository.dart';
import '../../modules/transport/bloc/track_live_bloc.dart';
import '../../modules/transport/repositories/mock_transport_repository.dart';
import '../../modules/transport/repositories/transport_repository_interface.dart';

/// Registers the home modules' repositories (interface -> implementation) and BLoCs:
/// home, leave, live classes, transport (Track Live) and behaviour.
/// Backend switch: choose the implementation with AppConfig here (mock today).
void registerHomeModule(GetIt getIt) {
  final cache = getIt<CacheService>();
  getIt.registerLazySingleton<ILiveClassRepository>(
    () => MockLiveClassRepository(cache),
  );
  getIt.registerLazySingleton<ILeaveRepository>(
    () => MockLeaveRepository(cache, attendance: getIt()),
  );
  getIt.registerLazySingleton<ITransportRepository>(
    () => MockTransportRepository(cache),
  );
  getIt.registerLazySingleton<IBehaviourRepository>(
    () => MockBehaviourRepository(cache),
  );
  // Home composes other modules' repositories, so it is backend-agnostic.
  getIt.registerLazySingleton<IHomeRepository>(
    () => HomeRepository(
      cache: cache,
      timetable: getIt(),
      attendance: getIt(),
      homework: getIt(),
      notices: getIt(),
      liveClasses: getIt(),
      transport: getIt(),
    ),
  );
  getIt.registerFactory<HomeBloc>(() => HomeBloc(getIt()));
  getIt.registerFactory<LiveClassesBloc>(() => LiveClassesBloc(getIt()));
  getIt.registerFactory<LeaveBloc>(() => LeaveBloc(getIt()));
  getIt.registerFactory<LeaveOverviewBloc>(() => LeaveOverviewBloc(getIt()));
  getIt.registerFactory<LeaveApplyBloc>(() => LeaveApplyBloc(getIt()));
  getIt.registerFactory<TrackLiveBloc>(() => TrackLiveBloc(getIt()));
  getIt.registerFactory<BehaviourBloc>(() => BehaviourBloc(getIt()));
}
