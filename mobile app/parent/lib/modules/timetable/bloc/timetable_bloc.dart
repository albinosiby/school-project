import '../../../core/bloc/child_data_bloc.dart';
import '../models/timetable_models.dart';
import '../repositories/timetable_repository_interface.dart';

export 'timetable_events.dart';
export 'timetable_states.dart';

class TimetableBloc extends ChildDataBloc<TimetableWeek> {
  TimetableBloc(ITimetableRepository repo) : super(repo.watchWeek);
}
