import 'package:firebase_auth/firebase_auth.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/firebase/push_service.dart';
import '../../family/models/family_models.dart';
import 'auth_repository_interface.dart';

/// Email login the school created (data contract §13.1): the guardian sets the password from the invite email.
class FirebaseAuthRepository implements IAuthRepository {
  FirebaseAuthRepository(this._session, this._push);
  final ParentSession _session;
  final ParentPushService _push;

  @override
  Future<Guardian> login(String email, String password) async {
    try {
      await _session.auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    } on FirebaseAuthException catch (e) {
      throw AppException(message: authMessage(e), statusCode: 401);
    }
    try {
      return await _guardian();
    } catch (_) {
      await _session.auth.signOut();
      rethrow;
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
  Future<Guardian?> currentGuardian() async {
    if (_session.auth.currentUser == null) return null;
    try {
      return await _guardian();
    } on AppException {
      await _session.auth.signOut();
      return null;
    }
  }

  @override
  Future<void> logout() async {
    await _push.stop();
    await _session.auth.signOut();
    _session.clear();
  }

  Future<Guardian> _guardian() async {
    final u = await _session.load();
    final first = _session.studentIds.isEmpty ? const <String, dynamic>{} : await _session.student(_session.studentIds.first);
    await _push.start(_session.uid);
    return Guardian(
      id: _session.uid,
      name: '${u['name'] ?? first['guardian'] ?? ''}',
      email: '${u['email'] ?? _session.auth.currentUser?.email ?? ''}',
      phone: '${u['phone'] ?? first['phone'] ?? ''}',
      relation: '${first['relation'] ?? 'Parent'}',
    );
  }

  static String authMessage(FirebaseAuthException e) => switch (e.code) {
        'invalid-credential' || 'wrong-password' || 'user-not-found' || 'invalid-email' => 'Incorrect email or password.',
        'user-disabled' => 'This login has been disabled. Contact the school office.',
        'too-many-requests' => 'Too many attempts. Try again in a few minutes.',
        'network-request-failed' => 'No internet connection. Check your network and try again.',
        _ => e.message ?? 'Sign-in failed.',
      };
}
