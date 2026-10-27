import '../../../constants/app_constants.dart';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/local_storage_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../../family/models/family_models.dart';
import '../models/auth_models.dart';
import 'auth_demo_data.dart';
import 'auth_repository_interface.dart';

/// Accepts the demo guardian only (mobile [DemoData.guardian] phone, or [DemoData.demoEmail] / [DemoData.demoPassword]).
/// Every passcode is [AuthDemoData.demoOtp]; the session is kept in local storage.
class MockAuthRepository implements IAuthRepository {
  MockAuthRepository(this._storage, {DateTime Function()? clock})
    : _now = clock ?? DateTime.now;
  final LocalStorageService _storage;
  final DateTime Function() _now;
  int _seq = 0;

  static String digitsOf(String s) => s.replaceAll(RegExp(r'\D'), '');
  static final _guardianMobile = digitsOf(DemoData.guardian.phone).substring(2);

  OtpChallenge _challenge(OtpChannel channel) {
    final now = _now();
    return OtpChallenge(
      id: 'otp_${++_seq}',
      phone: DemoData.guardian.phone,
      channel: channel,
      sentAt: now,
      expiresAt: now.add(const Duration(minutes: 10)),
    );
  }

  @override
  Future<OtpChallenge> requestOtpForMobile(String mobile) async {
    await MockLatency.wait();
    final d = digitsOf(mobile);
    if (d.length != 10) {
      throw AppException(message: 'Enter a valid 10-digit mobile number.');
    }
    if (d != _guardianMobile) {
      throw AppException(
        message: 'This number is not linked to any admission record.',
        statusCode: 404,
      );
    }
    return _challenge(OtpChannel.sms);
  }

  @override
  Future<OtpChallenge> requestOtpWithPassword(
    String email,
    String password,
  ) async {
    await MockLatency.wait();
    if (email.trim().toLowerCase() != DemoData.demoEmail ||
        password != DemoData.demoPassword) {
      throw AppException(
        message: 'Incorrect email or password.',
        statusCode: 401,
      );
    }
    return _challenge(OtpChannel.sms);
  }

  @override
  Future<OtpChallenge> resendOtp(
    OtpChallenge challenge,
    OtpChannel channel,
  ) async {
    await MockLatency.wait();
    return _challenge(channel);
  }

  @override
  Future<Guardian> verifyOtp(OtpChallenge challenge, String code) async {
    await MockLatency.wait();
    if (challenge.isExpiredAt(_now())) {
      throw AppException(
        message: 'This passcode has expired. Request a new one.',
      );
    }
    if (code != AuthDemoData.demoOtp) {
      throw AppException(message: 'Incorrect passcode.', statusCode: 401);
    }
    return _startSession();
  }

  @override
  Future<Guardian> signInWithProvider(SocialProvider provider) async {
    await MockLatency.wait();
    return _startSession();
  }

  Future<Guardian> _startSession() async {
    await _storage.setString(AppConstants.sessionKey, DemoData.guardian.id);
    return DemoData.guardian;
  }

  @override
  Future<void> sendPasswordReset(String email) async {
    await MockLatency.wait();
    if (!email.contains('@')) {
      throw AppException(message: 'Enter a valid email address.');
    }
  }

  @override
  Future<Guardian?> currentGuardian() async =>
      _storage.getString(AppConstants.sessionKey) == DemoData.guardian.id
      ? DemoData.guardian
      : null;

  @override
  Future<void> logout() => _storage.remove(AppConstants.sessionKey);
}
