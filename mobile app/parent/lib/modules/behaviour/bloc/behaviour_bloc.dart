import '../../../core/bloc/child_data_bloc.dart';
import '../models/behaviour_models.dart';
import '../repositories/behaviour_repository_interface.dart';
import 'behaviour_events.dart';

export 'behaviour_events.dart';
export 'behaviour_states.dart';

class BehaviourBloc extends ChildDataBloc<BehaviourReport> {
  BehaviourBloc(this._repo) : super(_repo.watchReport) {
    // The repository stream pushes the updated report, so the UI updates itself.
    on<AcknowledgeConduct>((event, emit) {
      final id = state.childId;
      if (id != null) {
        return _repo.acknowledge(id, event.entryId, note: event.note);
      }
    });
  }

  final IBehaviourRepository _repo;
}
