import '../models/home_models.dart';

/// Faculty profile details (qualifications, ID card data). Name/contact live in ISchoolRepository.
abstract class IProfileRepository {
  Future<FacultyProfile> getProfile();
  Future<void> updateProfile(FacultyProfile profile);
  Stream<void> watch();
}
