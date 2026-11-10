import 'dart:async';
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../config/app_config.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/firebase/push_service.dart';
import '../../family/models/family_models.dart';
import '../models/auth_models.dart';
import 'auth_repository_interface.dart';

/// Email login the school created (data contract §13.1): the school issues and replaces the password.
/// Mobile passcodes and Google/Apple sign-in need SMS and OAuth set-up that the school has not done yet.
class FirebaseAuthRepository implements IAuthRepository {
  FirebaseAuthRepository(this._session, this._push);
  final ParentSession _session;
  final ParentPushService _push;
  Guardian? _signedIn;

  /// Email and password provided by the school. Firebase has no passcode step, so the returned challenge is
  /// already [OtpChallenge.verified] and [verifyOtp] just returns the signed-in guardian.
  @override
  Future<OtpChallenge> requestOtpWithPassword(
    String email,
    String password,
  ) async {
    final token = await _signInToken(email.trim(), password);
    try {
      await _session.auth.signInWithCustomToken(token);
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

  Future<String> _signInToken(String email, String password) async {
    const region = 'asia-south1';
    const function = 'signInParent';
    final project = _session.auth.app.options.projectId;
    final host = AppConfig.emulatorHost;
    final useAndroidHost = !kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        !AppConfig.emulatorUsb &&
        (host == 'localhost' || host == '127.0.0.1');
    final url = AppConfig.useEmulator
        ? Uri(
            scheme: 'http',
            host: useAndroidHost ? '10.0.2.2' : host,
            port: 5001,
            path: '/$project/$region/$function',
          )
        : Uri.https('$region-$project.cloudfunctions.net', '/$function');

    http.Response response;
    try {
      response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'data': {'email': email, 'password': password},
        }),
      ).timeout(const Duration(seconds: 35));
    } on TimeoutException {
      throw AppException(message: 'Sign-in timed out. Try again.');
    } on http.ClientException {
      throw AppException(message: 'Could not reach the school account service. Check your connection and try again.');
    }
    if (response.statusCode == 401) {
      throw AppException(
        message: 'Incorrect email or password. Ask your school if you need a replacement.',
        statusCode: 401,
      );
    }
    if (response.statusCode == 429) {
      throw AppException(
        message: 'Too many attempts. Try again later or contact your school.',
      );
    }
    if (response.statusCode == 200) {
      try {
        final body = jsonDecode(response.body);
        final result = body is Map ? body['result'] : null;
        final token = result is Map ? result['token'] : null;
        if (token is String && token.isNotEmpty) return token;
      } on FormatException {
        // A malformed response is treated as an unavailable sign-in service.
      }
    }
    throw AppException(message: 'Could not sign in. Try again or contact your school.');
  }

  @override
  Future<OtpChallenge> requestOtpForMobile(String mobile) async => throw AppException(
        message: 'Sign-in with a mobile number is not available yet. Use the email saved by your school and your password.',
      );

  @override
  Future<OtpChallenge> resendOtp(OtpChallenge challenge, OtpChannel channel) async => challenge;

  @override
  Future<Guardian> verifyOtp(OtpChallenge challenge, String code) async => _signedIn ?? await _guardian();

  @override
  Future<Guardian> signInWithProvider(SocialProvider provider) async => throw AppException(
        message: '${provider.label} sign-in is not set up for this school yet. Use the email saved by your school and your password.',
      );

  @override
  Future<Guardian?> currentGuardian() async {
    // the saved session is restored asynchronously: wait for Firebase Auth's first state before deciding
    final user = _session.auth.currentUser ??
        await _session.auth.authStateChanges().first.timeout(const Duration(seconds: 10), onTimeout: () => null);
    if (user == null) return null;
    try {
      return await _guardian();
    } on AppException {
      await logout();
      return null;
    } on FirebaseException catch (e) {
      if (e.code != 'permission-denied') rethrow;
      await logout();
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
    await _push.start(_session.uid, credentialVersion: u['parentCredentialVersion'] as String?);
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
