import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart' show errorMessage;
import '../models/auth_models.dart';
import '../repositories/auth_repository_interface.dart';

export '../models/auth_models.dart';

enum AuthStatus { unknown, unauthenticated, authenticating, authenticated }

enum ResetStatus { idle, sending, sent, failed }

class AuthState extends Equatable {
  const AuthState({this.status = AuthStatus.unknown, this.user, this.error, this.reset = ResetStatus.idle, this.resetError});
  final AuthStatus status;
  final CrewUser? user;
  final String? error, resetError;
  final ResetStatus reset;

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;

  AuthState copyWith({AuthStatus? status, CrewUser? user, String? error, bool clearError = false, ResetStatus? reset, String? resetError}) =>
      AuthState(status: status ?? this.status, user: user ?? this.user, error: clearError ? null : error ?? this.error, reset: reset ?? this.reset, resetError: resetError);

  @override
  List<Object?> get props => [status, user, error, reset, resetError];
}

sealed class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

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

class PasswordResetCleared extends AuthEvent {
  const PasswordResetCleared();
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

/// Session restore, email + password sign-in, password reset, sign-out.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repo) : super(const AuthState()) {
    on<AuthStarted>((event, emit) async {
      final u = await _repo.restore();
      emit(u == null ? const AuthState(status: AuthStatus.unauthenticated) : AuthState(status: AuthStatus.authenticated, user: u));
    });
    on<LoginSubmitted>((e, emit) async {
      emit(state.copyWith(status: AuthStatus.authenticating, clearError: true));
      try {
        final u = await _repo.signIn(e.email, e.password);
        emit(AuthState(status: AuthStatus.authenticated, user: u));
      } catch (err) {
        emit(AuthState(status: AuthStatus.unauthenticated, error: errorMessage(err)));
      }
    }, transformer: droppable());
    on<PasswordResetRequested>((e, emit) async {
      emit(state.copyWith(reset: ResetStatus.sending));
      try {
        await _repo.sendPasswordReset(e.email);
        emit(state.copyWith(reset: ResetStatus.sent));
      } catch (err) {
        emit(state.copyWith(reset: ResetStatus.failed, resetError: errorMessage(err)));
      }
    });
    on<PasswordResetCleared>((e, emit) => emit(state.copyWith(reset: ResetStatus.idle)));
    on<LogoutRequested>((e, emit) async {
      await _repo.signOut();
      emit(const AuthState(status: AuthStatus.unauthenticated));
    });
  }
  final IAuthRepository _repo;
}
