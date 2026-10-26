import 'package:equatable/equatable.dart';
import '../models/auth_models.dart';

enum AuthStatus { unknown, unauthenticated, authenticating, authenticated }

class AuthState extends Equatable {
  const AuthState({this.status = AuthStatus.unknown, this.user, this.error, this.notice});
  final AuthStatus status;
  final AuthUser? user;

  /// Shown on the sign-in / forgot-password screens.
  final String? error, notice;

  bool get signedIn => status == AuthStatus.authenticated;
  bool get busy => status == AuthStatus.authenticating;

  AuthState copyWith({AuthStatus? status, AuthUser? user, String? error, String? notice, bool clearUser = false}) =>
      AuthState(status: status ?? this.status, user: clearUser ? null : user ?? this.user, error: error, notice: notice);

  @override
  List<Object?> get props => [status, user, error, notice];
}
