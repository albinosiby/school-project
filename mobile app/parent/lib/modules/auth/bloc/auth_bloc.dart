import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../repositories/auth_repository_interface.dart';
import 'auth_events.dart';
import 'auth_states.dart';

export 'auth_events.dart';
export 'auth_states.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repo) : super(const AuthState()) {
    on<AuthStarted>((event, emit) async {
      final g = await _repo.currentGuardian();
      emit(
        g == null
            ? const AuthState(status: AuthStatus.unauthenticated)
            : AuthState(status: AuthStatus.authenticated, guardian: g),
      );
    });
    on<LoginSubmitted>((event, emit) async {
      emit(state.copyWith(status: AuthStatus.authenticating, clearError: true));
      try {
        final g = await _repo.login(event.email, event.password);
        emit(AuthState(status: AuthStatus.authenticated, guardian: g));
      } catch (e) {
        emit(
          AuthState(status: AuthStatus.unauthenticated, error: errorMessage(e)),
        );
      }
    });
    on<PasswordResetRequested>((event, emit) async {
      emit(state.copyWith(reset: ResetStatus.sending));
      try {
        await _repo.sendPasswordReset(event.email);
        emit(state.copyWith(reset: ResetStatus.sent));
      } catch (e) {
        emit(
          state.copyWith(
            reset: ResetStatus.failed,
            resetError: errorMessage(e),
          ),
        );
      }
    });
    on<PasswordResetCleared>(
      (event, emit) => emit(state.copyWith(reset: ResetStatus.idle)),
    );
    on<LogoutRequested>((event, emit) async {
      await _repo.logout();
      emit(const AuthState(status: AuthStatus.unauthenticated));
    });
  }

  final IAuthRepository _repo;
}
