import '../../../core/bloc/child_data_bloc.dart';
import '../models/marks_models.dart';
import '../repositories/marks_repository_interface.dart';

export 'marks_events.dart';
export 'marks_states.dart';

class MarksBloc extends ChildDataBloc<List<ExamResult>> {
  MarksBloc(IMarksRepository repo) : super(repo.watchExams);
}
