import '../../../core/bloc/child_data_bloc.dart';
import '../models/homework_models.dart';
import '../repositories/homework_repository_interface.dart';

export 'homework_events.dart';
export 'homework_states.dart';

class HomeworkBloc extends ChildDataBloc<List<Homework>> {
  HomeworkBloc(IHomeworkRepository repo) : super(repo.watchHomework);
}
