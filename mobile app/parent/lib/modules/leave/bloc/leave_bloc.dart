import '../../../core/bloc/child_data_bloc.dart';
import '../models/leave_models.dart';
import '../repositories/leave_repository_interface.dart';

export 'leave_events.dart';
export 'leave_states.dart';

class LeaveBloc extends ChildDataBloc<List<LeaveRequest>> {
  LeaveBloc(ILeaveRepository repo) : super(repo.watchLeaves);
}
