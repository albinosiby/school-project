import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/operations_screens.dart';

class OperationsViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!OperationsScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a operations screen');
    }
    return super.load(id);
  }
}
