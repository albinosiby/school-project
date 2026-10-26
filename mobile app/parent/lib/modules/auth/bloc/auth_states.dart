import 'package:equatable/equatable.dart';
import '../../family/models/family_models.dart';
import '../models/auth_models.dart';

/// unauthenticated -> authenticating (credentials / mobile) -> otpSent -> verifying -> authenticated.
enum AuthStatus {
  unknown,
  unauthenticated,
  authenticating,
  otpSent,
  verifying,
  authenticated,
}

enum ResetStatus { idle, sending, sent, failed }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.guardian,
    this.error,
    this.challenge,
    this.attempts = 0,
    this.resending = false,
    this.provider,
    this.reset = ResetStatus.idle,
    this.resetError,
  });
  final AuthStatus status;
  final Guardian? guardian;
  final String? error;

  /// The pending passcode while [status] is otpSent / verifying.
  final OtpChallenge? challenge;

  /// Wrong passcodes entered for [challenge].
  final int attempts;
  final bool resending;

  /// Set when signed in with Google / Apple (null for passcode sign-in).
  final SocialProvider? provider;
  final ResetStatus reset;
  final String? resetError;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get busy =>
      status == AuthStatus.authenticating || status == AuthStatus.verifying;

  /// No tries left for this passcode: a new one must be requested.
  bool get attemptsExhausted => attempts >= OtpChallenge.maxAttempts;

  AuthState copyWith({
    AuthStatus? status,
    Guardian? guardian,
    String? error,
    OtpChallenge? challenge,
    int? attempts,
    bool? resending,
    ResetStatus? reset,
    String? resetError,
    bool clearError = false,
    bool clearChallenge = false,
  }) => AuthState(
    status: status ?? this.status,
    guardian: guardian ?? this.guardian,
    error: clearError ? null : (error ?? this.error),
    challenge: clearChallenge ? null : (challenge ?? this.challenge),
    attempts: attempts ?? this.attempts,
    resending: resending ?? this.resending,
    provider: provider,
    reset: reset ?? this.reset,
    resetError: resetError,
  );

  @override
  List<Object?> get props => [
    status,
    guardian,
    error,
    challenge,
    attempts,
    resending,
    provider,
    reset,
    resetError,
  ];
}
