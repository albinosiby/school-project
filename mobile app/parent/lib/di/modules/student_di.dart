import 'package:get_it/get_it.dart';
import '../../modules/ptm/bloc/ptm_action_bloc.dart';
import '../../modules/ptm/bloc/ptm_bloc.dart';
import '../../modules/ptm/repositories/mock_ptm_repository.dart';
import '../../modules/ptm/repositories/ptm_repository_interface.dart';
import '../../modules/student/bloc/certificate_action_bloc.dart';
import '../../modules/student/bloc/certificates_bloc.dart';
import '../../modules/student/bloc/student_profile_bloc.dart';
import '../../modules/student/repositories/mock_student_repository.dart';
import '../../modules/student/repositories/student_repository_interface.dart';
import '../../modules/teachers/bloc/teachers_bloc.dart';
import '../../modules/teachers/repositories/mock_teachers_repository.dart';
import '../../modules/teachers/repositories/teachers_repository_interface.dart';
import '../../utils/services/cache_service.dart';

/// Registers the student modules' repositories (interface -> implementation) and BLoCs.
/// Backend switch: choose the implementation with AppConfig here (mock today).
void registerStudentModule(GetIt getIt) {
  final cache = getIt<CacheService>();
  getIt.registerLazySingleton<IStudentRepository>(
    () => MockStudentRepository(cache),
  );
  getIt.registerLazySingleton<ITeachersRepository>(
    () => MockTeachersRepository(cache),
  );
  getIt.registerLazySingleton<IPtmRepository>(() => MockPtmRepository(cache));
  getIt.registerFactory<StudentProfileBloc>(() => StudentProfileBloc(getIt()));
  getIt.registerFactory<CertificatesBloc>(() => CertificatesBloc(getIt()));
  getIt.registerFactory<CertificateActionBloc>(
    () => CertificateActionBloc(getIt()),
  );
  getIt.registerFactory<TeachersBloc>(() => TeachersBloc(getIt()));
  getIt.registerFactory<PtmBloc>(() => PtmBloc(getIt()));
  getIt.registerFactory<PtmActionBloc>(() => PtmActionBloc(getIt()));
}
