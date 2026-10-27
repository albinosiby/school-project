import '../../family/models/family_models.dart';
import '../models/auth_models.dart';

/// Sign-in is two steps: identify the guardian (mobile number or email + password), then verify the passcode.
abstract class IAuthRepository {
  /// Sends a passcode to a registered mobile number (10 digits). Throws [AppException] if it is not linked.
  Future<OtpChallenge> requestOtpForMobile(String mobile);

  /// Checks email + password, then sends a passcode to the guardian's registered mobile.
  /// Throws [AppException] on bad credentials.
  Future<OtpChallenge> requestOtpWithPassword(String email, String password);

  /// Sends a new passcode for the same sign-in over [channel].
  Future<OtpChallenge> resendOtp(OtpChallenge challenge, OtpChannel channel);

  /// Verifies the passcode and starts the session. Throws [AppException] on a wrong or expired code.
  Future<Guardian> verifyOtp(OtpChallenge challenge, String code);

  /// Google / Apple sign-in (simulated: signs in the demo guardian).
  Future<Guardian> signInWithProvider(SocialProvider provider);

  Future<void> sendPasswordReset(String email);

  /// The guardian of the saved session, or null when signed out.
  Future<Guardian?> currentGuardian();
  Future<void> logout();
}
