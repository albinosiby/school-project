import '../../modules/engage/repositories/chat_media_repository.dart';
import 'package:get_it/get_it.dart';
import '../../config/app_config.dart';
import '../../modules/attendance/repositories/attendance_repository_interface.dart';
import '../../modules/attendance/repositories/marks_repository_interface.dart';
import '../../modules/classes/bloc/class_hub_bloc.dart';
import '../../modules/classes/bloc/class_management_bloc.dart';
import '../../modules/classes/repositories/class_management_repository.dart';
import '../../modules/classes/repositories/class_management_repository_interface.dart';
import '../../modules/classes/bloc/student_profile_bloc.dart';
import '../../modules/classes/repositories/student_details_repository.dart';
import '../../modules/classes/repositories/student_details_repository_interface.dart';
import '../../modules/school/repositories/school_repository_interface.dart';
import '../../modules/classes/bloc/behaviour_bloc.dart';
import '../../modules/classes/bloc/classes_bloc.dart';
import '../../modules/classes/bloc/documents_bloc.dart';
import '../../modules/classes/bloc/new_homework_bloc.dart';
import '../../modules/classes/bloc/resources_bloc.dart';
import '../../modules/classes/bloc/students_bloc.dart';
import '../../modules/classes/repositories/behaviour_repository.dart';
import '../../modules/classes/repositories/behaviour_repository_interface.dart';
import '../../modules/classes/repositories/classes_repository.dart';
import '../../modules/classes/repositories/classes_repository_interface.dart';
import '../../modules/classes/repositories/documents_repository.dart';
import '../../modules/classes/repositories/documents_repository_interface.dart';
import '../../modules/classes/repositories/resources_repository.dart';
import '../../modules/classes/repositories/resources_repository_interface.dart';
import '../../modules/tasks/repositories/homework_repository_interface.dart';
import '../../utils/services/data_store.dart';

/// Registers the classes module's repositories (interface -> implementation) and BLoCs.
/// IHomeworkRepository is registered by the tasks module and resolved lazily.
void registerClassesModule(GetIt getIt) {
  getIt.registerLazySingleton<IClassesRepository>(() => LocalClassesRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IBehaviourRepository>(() => LocalBehaviourRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IResourcesRepository>(() => LocalResourcesRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IDocumentsRepository>(() => LocalDocumentsRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IClassManagementRepository>(() => LocalClassManagementRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IStudentDetailsRepository>(
    () => AppConfig.isFirebase ? FirebaseStudentDetailsRepository() : LocalStudentDetailsRepository(getIt<DataStore>()),
  );

  getIt.registerFactory<ClassesBloc>(() => ClassesBloc(getIt<IClassesRepository>(), getIt<IHomeworkRepository>(), getIt<IBehaviourRepository>(), getIt<IResourcesRepository>()));
  getIt.registerFactory<BehaviourBloc>(() => BehaviourBloc(getIt<IBehaviourRepository>()));
  getIt.registerFactory<ResourcesBloc>(
    () => ResourcesBloc(getIt<IResourcesRepository>(), getIt.isRegistered<IChatMediaRepository>() ? getIt<IChatMediaRepository>() : null),
  );
  getIt.registerFactory<StudentsBloc>(() => StudentsBloc(getIt<IBehaviourRepository>(), getIt<IClassesRepository>()));
  getIt.registerFactory<DocumentsBloc>(() => DocumentsBloc(getIt<IDocumentsRepository>()));
  getIt.registerFactory<ClassManagementBloc>(
    () => ClassManagementBloc(getIt<ISchoolRepository>(), getIt<IAttendanceRepository>(), getIt<IClassManagementRepository>()),
  );
  getIt.registerFactory<ClassHubBloc>(() => ClassHubBloc(getIt<IAttendanceRepository>(), getIt<IHomeworkRepository>()));
  getIt.registerFactory<StudentProfileBloc>(
    () => StudentProfileBloc(
      getIt<IAttendanceRepository>(),
      getIt<IMarksRepository>(),
      getIt<IHomeworkRepository>(),
      getIt<IBehaviourRepository>(),
      getIt<IStudentDetailsRepository>(),
      getIt<ISchoolRepository>(),
      getIt<IClassManagementRepository>(),
    ),
  );
  getIt.registerFactory<NewHomeworkBloc>(
    () => NewHomeworkBloc(getIt<IHomeworkRepository>(), getIt.isRegistered<IChatMediaRepository>() ? getIt<IChatMediaRepository>() : null),
  );
}
