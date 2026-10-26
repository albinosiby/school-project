import 'package:equatable/equatable.dart';
import '../models/auth_models.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

/// Restore a saved session on app start.
class AuthStarted extends AuthEvent {
  const AuthStarted();
}

/// Sign in step 1 (mobile tab): send a passcode to a registered mobile number.
class MobileOtpRequested extends AuthEvent {
  const MobileOtpRequested(this.mobile);
  final String mobile;
  @override
  List<Object?> get props => [mobile];
}

/// Sign in step 1 (School ID / email tab): check the password, then send a passcode to the registered mobile.
class LoginSubmitted extends AuthEvent {
  const LoginSubmitted(this.email, this.password);
  final String email, password;
  @override
  List<Object?> get props => [email, password];
}

/// Sign in step 2: verify the 6-digit passcode.
class OtpSubmitted extends AuthEvent {
  const OtpSubmitted(this.code);
  final String code;
  @override
  List<Object?> get props => [code];
}

/// Send a new passcode (resend / via WhatsApp / voice call).
class OtpResendRequested extends AuthEvent {
  const OtpResendRequested([this.channel = OtpChannel.sms]);
  final OtpChannel channel;
  @override
  List<Object?> get props => [channel];
}

/// Left the passcode step (Edit number / back): forget the pending sign-in.
class OtpCancelled extends AuthEvent {
  const OtpCancelled();
}

/// Google / Apple quick access (simulated).
class SocialSignInRequested extends AuthEvent {
  const SocialSignInRequested(this.provider);
  final SocialProvider provider;
  @override
  List<Object?> get props => [provider];
}

class PasswordResetRequested extends AuthEvent {
  const PasswordResetRequested(this.email);
  final String email;
  @override
  List<Object?> get props => [email];
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

/// Forgot-password screen opened: forget the previous result.
class PasswordResetCleared extends AuthEvent {
  const PasswordResetCleared();
}
