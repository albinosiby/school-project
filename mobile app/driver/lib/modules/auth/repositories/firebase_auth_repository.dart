import 'package:firebase_auth/firebase_auth.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/crew_session.dart';
import '../models/auth_models.dart';
import 'auth_repository_interface.dart';

/// Email login the transport office created (data contract 14.1): the crew member sets the password from the invite email.
class FirebaseAuthRepository implements IAuthRepository {
  FirebaseAuthRepository(this._session);
  final CrewSession _session;

  @override
  Future<CrewUser> signIn(String email, String password) async {
    try {
      await _session.auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    } on FirebaseAuthException catch (e) {
      throw AppException(message: authMessage(e), statusCode: 401);
    }
    try {
      return await _session.load();
    } catch (_) {
      await _session.auth.signOut();
      rethrow;
    }
  }

  @override
  Future<CrewUser?> restore() async {
    // the saved session is restored asynchronously: wait for Firebase Auth's first state before deciding
    final user = _session.auth.currentUser ??
        await _session.auth.authStateChanges().first.timeout(const Duration(seconds: 10), onTimeout: () => null);
    if (user == null) return null;
    try {
      return await _session.load();
    } on AppException {
      await _session.auth.signOut();
      return null;
    }
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    if (!email.contains('@')) throw AppException(message: 'Enter a valid email address.');
    try {
      await _session.auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      throw AppException(message: authMessage(e));
    }
  }

  @override
  Future<void> signOut() async {
    await _session.auth.signOut();
    _session.clear();
  }

  static String authMessage(FirebaseAuthException e) => switch (e.code) {
    'invalid-credential' || 'wrong-password' || 'user-not-found' || 'invalid-email' => 'Incorrect email or password.',
    'user-disabled' => 'This login has been disabled. Contact the transport office.',
    'too-many-requests' => 'Too many attempts. Try again in a few minutes.',
    'network-request-failed' => 'No internet connection. Check your network and try again.',
    _ => e.message ?? 'Sign-in failed.',
  };
}
