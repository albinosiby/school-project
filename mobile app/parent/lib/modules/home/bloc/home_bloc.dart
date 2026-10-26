import '../../../core/bloc/child_data_bloc.dart';
import '../models/home_models.dart';
import '../repositories/home_repository_interface.dart';

export 'home_events.dart';
export 'home_states.dart';

class HomeBloc extends ChildDataBloc<HomeSummary> {
  HomeBloc(IHomeRepository repo) : super(repo.watchToday);
}
