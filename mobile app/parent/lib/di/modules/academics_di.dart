import 'package:get_it/get_it.dart';
import '../../utils/services/cache_service.dart';
import '../../modules/attendance/bloc/attendance_bloc.dart';
import '../../modules/attendance/repositories/attendance_repository_interface.dart';
import '../../modules/attendance/repositories/mock_attendance_repository.dart';
import '../../modules/fees/bloc/fee_payment_bloc.dart';
import '../../modules/fees/bloc/fees_bloc.dart';
import '../../modules/fees/repositories/fee_repository_interface.dart';
import '../../modules/fees/repositories/mock_fee_repository.dart';
import '../../modules/homework/bloc/homework_bloc.dart';
import '../../modules/homework/repositories/homework_repository_interface.dart';
import '../../modules/homework/repositories/mock_homework_repository.dart';
import '../../modules/marks/bloc/marks_bloc.dart';
import '../../modules/marks/repositories/marks_repository_interface.dart';
import '../../modules/marks/repositories/mock_marks_repository.dart';
import '../../modules/timetable/bloc/timetable_bloc.dart';
import '../../modules/timetable/repositories/mock_timetable_repository.dart';
import '../../modules/timetable/repositories/timetable_repository_interface.dart';

/// Registers the academics modules' repositories (interface -> implementation) and BLoCs.
/// Backend switch: choose the implementation with AppConfig here (mock today).
void registerAcademicsModule(GetIt getIt) {
  final cache = getIt<CacheService>();
  getIt.registerLazySingleton<IAttendanceRepository>(
    () => MockAttendanceRepository(cache),
  );
  getIt.registerLazySingleton<IHomeworkRepository>(
    () => MockHomeworkRepository(cache),
  );
  getIt.registerLazySingleton<IMarksRepository>(
    () => MockMarksRepository(cache),
  );
  getIt.registerLazySingleton<ITimetableRepository>(
    () => MockTimetableRepository(cache),
  );
  getIt.registerLazySingleton<IFeeRepository>(() => MockFeeRepository(cache));
  getIt.registerFactory<AttendanceBloc>(() => AttendanceBloc(getIt()));
  getIt.registerFactory<HomeworkBloc>(() => HomeworkBloc(getIt()));
  getIt.registerFactory<MarksBloc>(() => MarksBloc(getIt()));
  getIt.registerFactory<TimetableBloc>(() => TimetableBloc(getIt()));
  getIt.registerFactory<FeesBloc>(() => FeesBloc(getIt()));
  getIt.registerFactory<FeePaymentBloc>(() => FeePaymentBloc(getIt()));
}
