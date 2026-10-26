import 'package:get_it/get_it.dart';
import '../../modules/school/repositories/school_repository_interface.dart';
import '../../modules/tasks/bloc/duties_bloc.dart';
import '../../modules/tasks/bloc/homework_bloc.dart';
import '../../modules/tasks/bloc/syllabus_bloc.dart';
import '../../modules/tasks/bloc/task_form_bloc.dart';
import '../../modules/tasks/bloc/tasks_bloc.dart';
import '../../modules/tasks/repositories/duty_repository.dart';
import '../../modules/tasks/repositories/duty_repository_interface.dart';
import '../../modules/tasks/repositories/homework_repository.dart';
import '../../modules/tasks/repositories/homework_repository_interface.dart';
import '../../modules/tasks/repositories/syllabus_repository.dart';
import '../../modules/tasks/repositories/syllabus_repository_interface.dart';
import '../../modules/tasks/repositories/task_repository.dart';
import '../../modules/tasks/repositories/task_repository_interface.dart';
import '../../utils/services/data_store.dart';

/// Registers the tasks module's repositories (interface -> implementation) and BLoCs.
void registerTasksModule(GetIt getIt) {
  getIt.registerLazySingleton<IHomeworkRepository>(() => LocalHomeworkRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ITaskRepository>(() => LocalTaskRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IDutyRepository>(() => LocalDutyRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ISyllabusRepository>(() => LocalSyllabusRepository(getIt<DataStore>()));

  getIt.registerFactory<TasksBloc>(() => TasksBloc(getIt<ITaskRepository>(), getIt<IHomeworkRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<TaskFormBloc>(() => TaskFormBloc(getIt<ITaskRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<DutiesBloc>(() => DutiesBloc(getIt<IDutyRepository>(), getIt<IHomeworkRepository>(), getIt<ISyllabusRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<HomeworkBloc>(() => HomeworkBloc(getIt<IHomeworkRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<SyllabusBloc>(() => SyllabusBloc(getIt<ISyllabusRepository>()));
}
