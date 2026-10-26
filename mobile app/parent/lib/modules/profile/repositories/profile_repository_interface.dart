import '../models/guardian_profile.dart';

abstract class IProfileRepository {
  /// The signed-in guardian's profile (cache-first; saves push the new value).
  Stream<GuardianProfile> watchProfile();

  /// Saves the profile. The guardian part flows into FamilyBloc (header, home greeting, ...).
  /// Throws [AppException] when the server rejects it.
  Future<void> updateProfile(GuardianProfile profile);

  /// Simulated photo change: a style index, or null to remove the photo.
  Future<void> setPhoto(int? style);
}
