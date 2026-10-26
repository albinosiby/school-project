import 'package:get_it/get_it.dart';
import '../../modules/attendance/bloc/circulars_bloc.dart';
import '../../modules/attendance/bloc/leave_bloc.dart';
import '../../modules/attendance/bloc/mark_attendance_bloc.dart';
import '../../modules/attendance/bloc/marks_bloc.dart';
import '../../modules/attendance/bloc/overview_bloc.dart';
import '../../modules/attendance/bloc/self_log_bloc.dart';
import '../../modules/attendance/bloc/slips_bloc.dart';
import '../../modules/attendance/bloc/trends_bloc.dart';
import '../../modules/attendance/repositories/attendance_repository.dart';
import '../../modules/attendance/repositories/attendance_repository_interface.dart';
import '../../modules/attendance/repositories/circulars_repository.dart';
import '../../modules/attendance/repositories/circulars_repository_interface.dart';
import '../../modules/attendance/repositories/leave_repository.dart';
import '../../modules/attendance/repositories/leave_repository_interface.dart';
import '../../modules/attendance/repositories/marks_repository.dart';
import '../../modules/attendance/repositories/marks_repository_interface.dart';
import '../../modules/school/repositories/school_repository_interface.dart';
import '../../utils/services/data_store.dart';

/// Registers the attendance module's repositories (interface -> implementation) and BLoCs.
void registerAttendanceModule(GetIt getIt) {
  getIt.registerLazySingleton<IAttendanceRepository>(() => LocalAttendanceRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IMarksRepository>(() => LocalMarksRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ILeaveRepository>(() => LocalLeaveRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ICircularsRepository>(() => LocalCircularsRepository(getIt<DataStore>()));

  getIt.registerFactory<MarkAttendanceBloc>(() => MarkAttendanceBloc(getIt<IAttendanceRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<TrendsBloc>(() => TrendsBloc(getIt<IAttendanceRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<SelfLogBloc>(() => SelfLogBloc(getIt<IAttendanceRepository>(), getIt<ILeaveRepository>()));
  getIt.registerFactory<OverviewBloc>(() => OverviewBloc(getIt<IAttendanceRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<SlipsBloc>(() => SlipsBloc(getIt<IAttendanceRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<MarksBloc>(() => MarksBloc(getIt<IMarksRepository>(), getIt<IAttendanceRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<LeaveBloc>(() => LeaveBloc(getIt<ILeaveRepository>()));
  getIt.registerFactory<CircularsBloc>(() => CircularsBloc(getIt<ICircularsRepository>()));
}
