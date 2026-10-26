import 'package:equatable/equatable.dart';
import '../../family/models/family_models.dart';

enum AuthStatus { unknown, unauthenticated, authenticating, authenticated }

enum ResetStatus { idle, sending, sent, failed }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.guardian,
    this.error,
    this.reset = ResetStatus.idle,
    this.resetError,
  });
  final AuthStatus status;
  final Guardian? guardian;
  final String? error;
  final ResetStatus reset;
  final String? resetError;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    Guardian? guardian,
    String? error,
    ResetStatus? reset,
    String? resetError,
    bool clearError = false,
  }) => AuthState(
    status: status ?? this.status,
    guardian: guardian ?? this.guardian,
    error: clearError ? null : (error ?? this.error),
    reset: reset ?? this.reset,
    resetError: resetError,
  );

  @override
  List<Object?> get props => [status, guardian, error, reset, resetError];
}
