import 'package:equatable/equatable.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

/// App start: restore the persisted session.
class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class AuthSignInRequested extends AuthEvent {
  const AuthSignInRequested(this.email, this.password);
  final String email, password;
  @override
  List<Object?> get props => [email, password];
}

/// "Continue with Google" on the login page.
class AuthGoogleSignInRequested extends AuthEvent {
  const AuthGoogleSignInRequested();
}

class AuthPasswordResetRequested extends AuthEvent {
  const AuthPasswordResetRequested(this.email);
  final String email;
  @override
  List<Object?> get props => [email];
}

class AuthSignOutRequested extends AuthEvent {
  const AuthSignOutRequested();
}

/// Clears the error / notice banner.
class AuthMessageCleared extends AuthEvent {
  const AuthMessageCleared();
}
