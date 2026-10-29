import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/crew_screens.dart';

class CrewViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!CrewScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a crew screen');
    }
    return super.load(id);
  }
}
