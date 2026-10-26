import '../../family/models/family_models.dart';

abstract class IAuthRepository {
  /// Throws [AppException] on bad credentials.
  Future<Guardian> login(String email, String password);
  Future<void> sendPasswordReset(String email);

  /// The guardian of the saved session, or null when signed out.
  Future<Guardian?> currentGuardian();
  Future<void> logout();
}
