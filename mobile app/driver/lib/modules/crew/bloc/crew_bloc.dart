import '../../../core/bloc/data_bloc.dart';
import '../models/crew_models.dart';
import '../repositories/crew_repository_interface.dart';

export '../../../core/bloc/data_bloc.dart';
export '../models/crew_models.dart';

/// Global: the signed-in crew member, their bus and partner (loaded after sign-in, cleared on sign-out).
class CrewBloc extends DataBloc<CrewContext> {
  CrewBloc(ICrewRepository repo) : super((_) => repo.watchContext());
}
