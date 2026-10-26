import '../../../utils/services/data_store.dart';
import '../models/home_models.dart';
import 'profile_repository_interface.dart';

class LocalProfileRepository implements IProfileRepository {
  LocalProfileRepository(this._db);
  final DataStore _db;
  static const _c = 'hm_profile';

  @override
  Future<FacultyProfile> getProfile() async => FacultyProfile.fromJson(_db.doc(_c));

  @override
  Future<void> updateProfile(FacultyProfile profile) async => _db.setDoc(_c, profile.toJson());

  @override
  Stream<void> watch() => _db.watch({_c});
}
