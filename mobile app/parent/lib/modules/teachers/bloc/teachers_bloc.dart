import '../../../core/bloc/child_data_bloc.dart';
import '../models/teacher_models.dart';
import '../repositories/teachers_repository_interface.dart';

export 'teachers_events.dart';
export 'teachers_states.dart';

/// Teachers of the selected child (cache-first).
class TeachersBloc extends ChildDataBloc<TeachersData> {
  TeachersBloc(ITeachersRepository repo) : super(repo.watchTeachers);
}
