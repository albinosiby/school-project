import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:teacher_app/modules/auth/screens/login_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/config/routes/routes_config.dart';
import 'package:teacher_app/modules/auth/bloc/auth_bloc.dart';
import 'package:teacher_app/modules/auth/bloc/auth_events.dart';
import 'package:teacher_app/modules/auth/bloc/auth_states.dart';
import 'package:teacher_app/modules/auth/models/auth_models.dart';
import 'package:teacher_app/modules/auth/repositories/auth_repository_interface.dart';

const _teacher = AuthUser(uid: 'u1', email: 'anita.sharma@greenfield.edu', name: 'Anita', schoolId: 's1', staffId: 'stf_025');

class FakeAuthRepo implements IAuthRepository {
  FakeAuthRepo({this.session});
  AuthUser? session;
  bool signedOut = false;
  @override
  AuthUser? get currentUser => session;
  @override
  Future<AuthUser?> restoreSession() async => session;
  @override
  Future<AuthUser> signIn(String email, String password) async {
    if (password == 'bad') throw const AuthFailure('Incorrect email or password.');
    if (email.startsWith('parent')) throw const AuthFailure('This app is for teachers.');
    return session = _teacher;
  }
  /// 'cancel' | 'unregistered' | 'ok'
  String google = 'ok';
  @override
  Future<AuthUser> signInWithGoogle() async {
    if (google == 'cancel') throw const AuthCancelled();
    if (google == 'unregistered') throw const AuthFailure('x@gmail.com is not registered as a teacher.');
    return session = _teacher;
  }
  @override
  Future<void> sendPasswordReset(String email) async {}
  @override
  Future<void> signOut() async {
    signedOut = true;
    session = null;
  }
}

void main() {
  test('validators', () {
    expect(AuthValidators.email(''), isNotNull);
    expect(AuthValidators.email('abc'), isNotNull);
    expect(AuthValidators.email('a@b.co'), isNull);
    expect(AuthValidators.password(''), isNotNull);
    expect(AuthValidators.password('x'), isNull);
  });

  test('firebase error codes become friendly messages', () {
    expect(authMessage('wrong-password'), contains('Incorrect'));
    expect(authMessage('network-request-failed'), contains('internet'));
  });

  testWidgets('login page offers email/password and Google; Google signs in', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final bloc = AuthBloc(FakeAuthRepo());
    addTearDown(bloc.close);
    await tester.pumpWidget(ScreenUtilInit(
      designSize: const Size(390, 844),
      builder: (_, _) => BlocProvider.value(value: bloc, child: const MaterialApp(home: LoginScreen())),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Sign up'), findsNothing);
    await tester.ensureVisible(find.byKey(const Key('google_sign_in')));
    await tester.tap(find.byKey(const Key('google_sign_in')));
    await tester.pumpAndSettle();
    expect(bloc.state.signedIn, isTrue);
  });

  group('Google sign-in', () {
    test('registered teacher signs in', () async {
      final b = AuthBloc(FakeAuthRepo())..add(const AuthGoogleSignInRequested());
      final s = await b.stream.firstWhere((s) => s.signedIn);
      expect(s.user!.staffId, 'stf_025');
      await b.close();
    });
    test('closing the picker is silent', () async {
      final b = AuthBloc(FakeAuthRepo()..google = 'cancel')..add(const AuthGoogleSignInRequested());
      final s = await b.stream.firstWhere((s) => s.status == AuthStatus.unauthenticated);
      expect(s.error, isNull);
      await b.close();
    });
    test('an unregistered Google account gets a clear error', () async {
      final b = AuthBloc(FakeAuthRepo()..google = 'unregistered')..add(const AuthGoogleSignInRequested());
      final s = await b.stream.firstWhere((s) => s.status == AuthStatus.unauthenticated);
      expect(s.error, contains('not registered'));
      await b.close();
    });
    test('friendly message when the email already uses a password', () {
      expect(authMessage('account-exists-with-different-credential'), contains('password'));
    });
  });

  group('AuthBloc', () {
    test('restores a saved session', () async {
      final b = AuthBloc(FakeAuthRepo(session: _teacher))..add(const AuthStarted());
      expect((await b.stream.first).status, AuthStatus.authenticated);
      await b.close();
    });
    test('no session -> unauthenticated; sign in ok', () async {
      final b = AuthBloc(FakeAuthRepo())..add(const AuthStarted());
      expect((await b.stream.first).status, AuthStatus.unauthenticated);
      b.add(const AuthSignInRequested('a@b.co', 'pw'));
      final s = await b.stream.firstWhere((s) => s.signedIn);
      expect(s.user!.staffId, 'stf_025');
      await b.close();
    });
    test('wrong password and non-teacher accounts show the message', () async {
      final b = AuthBloc(FakeAuthRepo());
      b.add(const AuthSignInRequested('a@b.co', 'bad'));
      var s = await b.stream.firstWhere((s) => s.error != null);
      expect(s.status, AuthStatus.unauthenticated);
      expect(s.error, 'Incorrect email or password.');
      b.add(const AuthSignInRequested('parent@b.co', 'pw'));
      s = await b.stream.firstWhere((s) => s.error == 'This app is for teachers.');
      expect(s.signedIn, isFalse);
      await b.close();
    });
    test('password reset notice, then sign out', () async {
      final repo = FakeAuthRepo(session: _teacher);
      final b = AuthBloc(repo)..add(const AuthStarted());
      await b.stream.first;
      b.add(const AuthPasswordResetRequested('a@b.co'));
      expect((await b.stream.firstWhere((s) => s.notice != null)).notice, contains('a@b.co'));
      b.add(const AuthSignOutRequested());
      await b.stream.firstWhere((s) => s.status == AuthStatus.unauthenticated && s.notice == null);
      expect(repo.signedOut, isTrue);
      await b.close();
    });
  });

  group('auth redirect', () {
    const out = AuthState(status: AuthStatus.unauthenticated);
    const inn = AuthState(status: AuthStatus.authenticated, user: _teacher);
    test('signed out goes to login, signed in leaves it', () {
      expect(authRedirect(out, RoutePaths.home, enabled: true), RoutePaths.login);
      expect(authRedirect(out, RoutePaths.forgotPassword, enabled: true), isNull);
      expect(authRedirect(inn, RoutePaths.login, enabled: true), RoutePaths.home);
      expect(authRedirect(inn, RoutePaths.tasks, enabled: true), isNull);
    });
    test('guard is off for the local backend', () {
      expect(authRedirect(out, RoutePaths.home, enabled: false), isNull);
    });
  });
}
