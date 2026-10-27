import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../models/auth_models.dart';
import '../repositories/auth_repository_interface.dart';
import 'auth_events.dart';
import 'auth_states.dart';

export '../models/auth_models.dart';
export 'auth_events.dart';
export 'auth_states.dart';

/// Session + two-step sign-in (identify, then passcode) + Google/Apple (simulated) + password reset.
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
    on<MobileOtpRequested>(
      (e, emit) => _requestOtp(emit, () => _repo.requestOtpForMobile(e.mobile)),
      transformer: droppable(),
    );
    on<LoginSubmitted>(
      (e, emit) => _requestOtp(
        emit,
        () => _repo.requestOtpWithPassword(e.email, e.password),
      ),
      transformer: droppable(),
    );
    on<OtpSubmitted>(_verify, transformer: droppable());
    on<OtpResendRequested>(_resend, transformer: droppable());
    on<OtpCancelled>((event, emit) {
      if (state.isAuthenticated) return;
      emit(const AuthState(status: AuthStatus.unauthenticated));
    });
    on<SocialSignInRequested>((event, emit) async {
      emit(
        state.copyWith(
          status: AuthStatus.authenticating,
          clearError: true,
          clearChallenge: true,
        ),
      );
      try {
        final g = await _repo.signInWithProvider(event.provider);
        emit(
          AuthState(
            status: AuthStatus.authenticated,
            guardian: g,
            provider: event.provider,
          ),
        );
      } catch (e) {
        emit(
          AuthState(status: AuthStatus.unauthenticated, error: errorMessage(e)),
        );
      }
    }, transformer: droppable());
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

  Future<void> _requestOtp(
    Emitter<AuthState> emit,
    Future<OtpChallenge> Function() request,
  ) async {
    emit(
      state.copyWith(
        status: AuthStatus.authenticating,
        clearError: true,
        clearChallenge: true,
        attempts: 0,
      ),
    );
    try {
      final c = await request();
      emit(AuthState(status: AuthStatus.otpSent, challenge: c));
    } catch (e) {
      emit(
        AuthState(status: AuthStatus.unauthenticated, error: errorMessage(e)),
      );
    }
  }

  Future<void> _verify(OtpSubmitted event, Emitter<AuthState> emit) async {
    final c = state.challenge;
    if (c == null || state.status != AuthStatus.otpSent) return;
    if (state.attemptsExhausted) {
      emit(state.copyWith(error: 'Too many attempts. Request a new code.'));
      return;
    }
    emit(state.copyWith(status: AuthStatus.verifying, clearError: true));
    try {
      final g = await _repo.verifyOtp(c, event.code);
      emit(AuthState(status: AuthStatus.authenticated, guardian: g));
    } catch (e) {
      final attempts = state.attempts + 1;
      final left = OtpChallenge.maxAttempts - attempts;
      emit(
        state.copyWith(
          status: AuthStatus.otpSent,
          attempts: attempts,
          error: left > 0
              ? '${errorMessage(e)} $left ${left == 1 ? 'attempt' : 'attempts'} left.'
              : 'Too many attempts. Request a new code.',
        ),
      );
    }
  }

  Future<void> _resend(
    OtpResendRequested event,
    Emitter<AuthState> emit,
  ) async {
    final c = state.challenge;
    if (c == null || state.status != AuthStatus.otpSent) return;
    emit(state.copyWith(resending: true, clearError: true));
    try {
      final next = await _repo.resendOtp(c, event.channel);
      emit(AuthState(status: AuthStatus.otpSent, challenge: next));
    } catch (e) {
      emit(state.copyWith(resending: false, error: errorMessage(e)));
    }
  }
}
