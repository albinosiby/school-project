import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/auth_models.dart';
import '../repositories/auth_repository_interface.dart';
import 'auth_events.dart';
import 'auth_states.dart';

/// App-wide session state; the router redirect reads it.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repo) : super(const AuthState()) {
    on<AuthStarted>(_onStarted);
    on<AuthSignInRequested>(_onSignIn);
    on<AuthGoogleSignInRequested>(_onGoogle);
    on<AuthPasswordResetRequested>(_onReset);
    on<AuthSignOutRequested>(_onSignOut);
    on<AuthMessageCleared>((e, emit) => emit(state.copyWith()));
  }
  final IAuthRepository _repo;

  Future<void> _onStarted(AuthStarted e, Emitter<AuthState> emit) async {
    final u = await _repo.restoreSession();
    emit(u == null ? const AuthState(status: AuthStatus.unauthenticated) : AuthState(status: AuthStatus.authenticated, user: u));
  }

  Future<void> _onSignIn(AuthSignInRequested e, Emitter<AuthState> emit) async {
    emit(state.copyWith(status: AuthStatus.authenticating));
    try {
      final u = await _repo.signIn(e.email, e.password);
      emit(AuthState(status: AuthStatus.authenticated, user: u));
    } on AuthFailure catch (f) {
      emit(AuthState(status: AuthStatus.unauthenticated, error: f.message));
    } catch (_) {
      emit(const AuthState(status: AuthStatus.unauthenticated, error: 'Could not sign in. Please try again.'));
    }
  }

  Future<void> _onGoogle(AuthGoogleSignInRequested e, Emitter<AuthState> emit) async {
    emit(state.copyWith(status: AuthStatus.authenticating));
    try {
      final u = await _repo.signInWithGoogle();
      emit(AuthState(status: AuthStatus.authenticated, user: u));
    } on AuthCancelled {
      emit(const AuthState(status: AuthStatus.unauthenticated));
    } on AuthFailure catch (f) {
      emit(AuthState(status: AuthStatus.unauthenticated, error: f.message));
    } catch (_) {
      emit(const AuthState(status: AuthStatus.unauthenticated, error: 'Could not sign in with Google. Please try again.'));
    }
  }

  Future<void> _onReset(AuthPasswordResetRequested e, Emitter<AuthState> emit) async {
    emit(state.copyWith(status: AuthStatus.authenticating));
    try {
      await _repo.sendPasswordReset(e.email);
      emit(AuthState(status: AuthStatus.unauthenticated, notice: 'If ${e.email.trim()} has an account, a reset link is on its way. Check your inbox.'));
    } on AuthFailure catch (f) {
      emit(AuthState(status: AuthStatus.unauthenticated, error: f.message));
    } catch (_) {
      emit(const AuthState(status: AuthStatus.unauthenticated, error: 'Could not send the reset email. Please try again.'));
    }
  }

  Future<void> _onSignOut(AuthSignOutRequested e, Emitter<AuthState> emit) async {
    await _repo.signOut();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }
}
