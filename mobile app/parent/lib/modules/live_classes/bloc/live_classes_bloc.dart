import '../../../core/bloc/child_data_bloc.dart';
import '../models/live_class_models.dart';
import '../repositories/live_class_repository_interface.dart';
import 'live_classes_events.dart';

export 'live_classes_events.dart';
export 'live_classes_states.dart';

class LiveClassesBloc extends ChildDataBloc<List<LiveClass>> {
  LiveClassesBloc(this._repo) : super(_repo.watchLiveClasses) {
    on<JoinLiveClass>((event, emit) => _repo.recordJoin(event.classId));
  }

  final ILiveClassRepository _repo;
}
