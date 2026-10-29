import '../../../core/repositories/view_repository.dart';
import '../../../core/models/view_model.dart';
import '../models/transport_screens.dart';

class TransportViewRepository extends LocalViewRepository {
  @override
  Future<ScreenModel> load(String id) {
    if (!TransportScreens.ids.contains(id)) {
      throw ArgumentError.value(id, 'id', 'Not a transport screen');
    }
    return super.load(id);
  }
}
