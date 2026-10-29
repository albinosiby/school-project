import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/learning_screens.dart';

class LearningViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!LearningScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a learning screen');
    }
    return super.load(id);
  }
}
