import 'package:get_it/get_it.dart';
import '../../modules/school/bloc/school_bloc.dart';
import '../../modules/school/repositories/school_repository.dart';
import '../../modules/school/repositories/school_repository_interface.dart';
import '../../utils/services/data_store.dart';

void registerSchoolModule(GetIt getIt) {
  getIt.registerLazySingleton<ISchoolRepository>(() => LocalSchoolRepository(getIt<DataStore>()));
  getIt.registerFactory<SchoolBloc>(() => SchoolBloc(getIt<ISchoolRepository>()));
}
