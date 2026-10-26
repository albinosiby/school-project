import '../../../core/bloc/child_data_bloc.dart';
import '../models/leave_models.dart';
import '../repositories/leave_repository_interface.dart';

export 'leave_events.dart';

typedef LeaveOverviewState = DataState<LeaveOverview>;

/// Apply Leave screen data: history, allowances, attendance projection base.
class LeaveOverviewBloc extends ChildDataBloc<LeaveOverview> {
  LeaveOverviewBloc(ILeaveRepository repo) : super(repo.watchOverview);
}
