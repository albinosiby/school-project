import '../models/auth_models.dart';

/// Sign-in for the teacher app. Firebase: email + password or Google, then `users/{uid}` decides school and role.
abstract class IAuthRepository {
  AuthUser? get currentUser;

  /// The persisted session, or null when signed out.
  Future<AuthUser?> restoreSession();

  /// Throws [AuthFailure] with a user-facing message (wrong password, not a teacher account...).
  Future<AuthUser> signIn(String email, String password);

  /// Google sign-in. Works only for an email the school admin has registered for a teacher.
  /// Throws [AuthCancelled] when the teacher closes the Google picker.
  Future<AuthUser> signInWithGoogle();

  Future<void> sendPasswordReset(String email);
  Future<void> signOut();
}
