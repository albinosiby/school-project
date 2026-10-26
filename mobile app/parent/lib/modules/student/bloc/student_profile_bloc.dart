import '../../../core/bloc/child_data_bloc.dart';
import '../models/student_models.dart';
import '../repositories/student_repository_interface.dart';

export 'student_events.dart';
export 'student_states.dart';

/// Profile of the selected child (cache-first).
class StudentProfileBloc extends ChildDataBloc<StudentProfile> {
  StudentProfileBloc(IStudentRepository repo) : super(repo.watchProfile);
}
