import '../../../core/bloc/child_data_bloc.dart';
import '../models/resource_models.dart';
import '../repositories/resource_repository_interface.dart';

export '../../../core/bloc/child_data_bloc.dart' show ChildDataEvent, LoadChildData, RefreshChildData;

typedef ResourcesState = DataState<List<ClassResource>>;

/// Class resources shared with parents, for the selected child.
class ResourcesBloc extends ChildDataBloc<List<ClassResource>> {
  ResourcesBloc(IResourceRepository repo) : super(repo.watchResources);
}
