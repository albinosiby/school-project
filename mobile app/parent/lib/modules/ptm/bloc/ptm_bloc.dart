import '../../../core/bloc/child_data_bloc.dart';
import '../models/ptm_models.dart';
import '../repositories/ptm_repository_interface.dart';

export 'ptm_events.dart';
export 'ptm_states.dart';

/// Meetings, teachers and slots of the selected child (cache-first; bookings push fresh data).
class PtmBloc extends ChildDataBloc<PtmData> {
  PtmBloc(IPtmRepository repo) : super(repo.watchPtm);
}
