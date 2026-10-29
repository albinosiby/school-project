import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/auth_screens.dart';

class AuthViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!AuthScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a auth screen');
    }
    return super.load(id);
  }
}
