import 'package:firebase_auth/firebase_auth.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/firebase/push_service.dart';
import '../../family/models/family_models.dart';
import '../models/auth_models.dart';
import 'auth_repository_interface.dart';

/// Email login the school created (data contract §13.1): the guardian sets the password from the invite email.
/// Mobile passcodes and Google/Apple sign-in need SMS and OAuth set-up that the school has not done yet.
class FirebaseAuthRepository implements IAuthRepository {
  FirebaseAuthRepository(this._session, this._push);
  final ParentSession _session;
  final ParentPushService _push;
  Guardian? _signedIn;

  /// Email + password from the school's invite. Firebase has no passcode step, so the returned challenge is
  /// already [OtpChallenge.verified] and [verifyOtp] just returns the signed-in guardian.
  @override
  Future<OtpChallenge> requestOtpWithPassword(String email, String password) async {
    try {
      await _session.auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    } on FirebaseAuthException catch (e) {
      throw AppException(message: authMessage(e), statusCode: 401);
    }
    try {
      _signedIn = await _guardian();
    } catch (_) {
      await _session.auth.signOut();
      rethrow;
    }
    final now = DateTime.now();
    return OtpChallenge(id: 'firebase', phone: _signedIn!.phone, channel: OtpChannel.sms, sentAt: now, expiresAt: now.add(const Duration(minutes: 10)), verified: true);
  }

  @override
  Future<OtpChallenge> requestOtpForMobile(String mobile) async => throw AppException(
        message: 'Sign-in with a mobile number is not available yet. Use the email and password from the school\'s invite.',
      );

  @override
  Future<OtpChallenge> resendOtp(OtpChallenge challenge, OtpChannel channel) async => challenge;

  @override
  Future<Guardian> verifyOtp(OtpChallenge challenge, String code) async => _signedIn ?? await _guardian();

  @override
  Future<Guardian> signInWithProvider(SocialProvider provider) async => throw AppException(
        message: '${provider.label} sign-in is not set up for this school yet. Use the email and password from the school\'s invite.',
      );

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
    // the saved session is restored asynchronously: wait for Firebase Auth's first state before deciding
    final user = _session.auth.currentUser ??
        await _session.auth.authStateChanges().first.timeout(const Duration(seconds: 10), onTimeout: () => null);
    if (user == null) return null;
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
    _signedIn = null;
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
