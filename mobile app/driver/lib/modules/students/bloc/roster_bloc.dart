import '../../../core/bloc/data_bloc.dart';
import '../models/student_models.dart';
import '../repositories/student_repository_interface.dart';

/// The students of a bus (key = busId).
class RosterBloc extends DataBloc<List<BusStudent>> {
  RosterBloc(IStudentRepository repo) : super(repo.watchRoster);
}
