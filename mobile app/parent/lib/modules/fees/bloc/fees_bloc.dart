import '../../../core/bloc/child_data_bloc.dart';
import '../models/fee_models.dart';
import '../repositories/fee_repository_interface.dart';

export 'fees_events.dart';
export 'fees_states.dart';

class FeesBloc extends ChildDataBloc<FeesData> {
  FeesBloc(IFeeRepository repo) : super(repo.watchFees);
}
