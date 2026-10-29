import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/attendant_screens.dart';

class AttendantViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!AttendantScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a attendant screen');
    }
    return super.load(id);
  }
}
