import '../models/auth_models.dart';

abstract class IAuthRepository {
  /// Email + password set from the school's invite. Throws [AppException] with a readable message.
  Future<CrewUser> signIn(String email, String password);

  /// The saved session, or null.
  Future<CrewUser?> restore();
  Future<void> sendPasswordReset(String email);
  Future<void> signOut();
}
