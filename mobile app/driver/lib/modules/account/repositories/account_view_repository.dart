import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/account_screens.dart';

class AccountViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!AccountScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a account screen');
    }
    return super.load(id);
  }
}
