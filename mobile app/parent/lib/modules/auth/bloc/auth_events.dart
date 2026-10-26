import 'package:equatable/equatable.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

/// Restore a saved session on app start.
class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class LoginSubmitted extends AuthEvent {
  const LoginSubmitted(this.email, this.password);
  final String email, password;
  @override
  List<Object?> get props => [email, password];
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
