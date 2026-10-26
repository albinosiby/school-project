import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes_config.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/modules/auth/repositories/auth_repository_interface.dart';
import 'helpers/pump_app.dart';

void main() {
  group('AuthBloc', () {
    test('login with the demo guardian authenticates', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>();
      expect(bloc.state.status, AuthStatus.unauthenticated);
      bloc.add(const LoginSubmitted(DemoData.demoEmail, DemoData.demoPassword));
      final s = await bloc.stream.firstWhere(
        (s) => s.status == AuthStatus.authenticated,
      );
      expect(s.guardian?.name, 'Mr. Rajesh Sharma');
    });

    test('wrong password gives an error and stays signed out', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()
        ..add(const LoginSubmitted(DemoData.demoEmail, 'nope'));
      final s = await bloc.stream.firstWhere((s) => s.error != null);
      expect(s.status, AuthStatus.unauthenticated);
      expect(s.error, contains('Incorrect'));
    });

    test('saved session is restored and logout clears it', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<AuthBloc>();
      expect(bloc.state.isAuthenticated, isTrue);
      bloc.add(const LogoutRequested());
      await bloc.stream.firstWhere(
        (s) => s.status == AuthStatus.unauthenticated,
      );
      // The saved session is gone, so a restart would show login.
      expect(await getIt<IAuthRepository>().currentGuardian(), isNull);
    });

    test('forgot password validates the email', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()..add(const PasswordResetRequested('bad'));
      expect(
        (await bloc.stream.firstWhere(
          (s) => s.reset == ResetStatus.failed,
        )).resetError,
        isNotNull,
      );
      bloc.add(const PasswordResetRequested(DemoData.demoEmail));
      await bloc.stream.firstWhere((s) => s.reset == ResetStatus.sent);
    });
  });

  test('redirect guard', () async {
    await setUpTestApp();
    final out = getIt<AuthBloc>().state;
    expect(authRedirect(out, '/home'), '/login');
    expect(authRedirect(out, '/login/forgot'), isNull);
    getIt<AuthBloc>().add(
      const LoginSubmitted(DemoData.demoEmail, DemoData.demoPassword),
    );
    final inn = await getIt<AuthBloc>().stream.firstWhere(
      (s) => s.isAuthenticated,
    );
    expect(authRedirect(inn, '/login'), '/home');
    expect(authRedirect(inn, '/attendance'), isNull);
  });

  group('login screen', () {
    testWidgets(
      'signed out users land on login; bad credentials show an error',
      (t) async {
        await setUpTestApp();
        await pumpApp(t);
        expect(find.text('Welcome, parent'), findsOneWidget);

        await t.enterText(
          find.widgetWithText(TextFormField, 'you@example.com'),
          DemoData.demoEmail,
        );
        await t.enterText(
          find.widgetWithText(TextFormField, 'Your password'),
          'wrong',
        );
        await t.tap(find.text('Sign in'));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('login-error')), findsOneWidget);
        expect(find.text('Welcome, parent'), findsOneWidget);
      },
    );

    testWidgets('empty form shows validation, valid login opens Today', (
      t,
    ) async {
      await setUpTestApp();
      await pumpApp(t);
      await t.tap(find.text('Sign in'));
      await t.pumpAndSettle();
      expect(find.text('Email is required'), findsOneWidget);

      await t.tap(find.text('Demo family'));
      await t.pump();
      await t.tap(find.text('Sign in'));
      await t.pumpAndSettle();
      expect(find.text('Today'), findsWidgets);
      expect(find.text('Welcome, parent'), findsNothing);
    });

    testWidgets('forgot password flow', (t) async {
      await setUpTestApp();
      await pumpApp(t);
      await t.tap(find.text('Forgot password?'));
      await t.pumpAndSettle();
      await t.enterText(
        find.widgetWithText(TextFormField, 'you@example.com'),
        DemoData.demoEmail,
      );
      await t.tap(find.text('Send reset link'));
      await t.pumpAndSettle();
      expect(find.text('Check your email'), findsOneWidget);
    });
  });
}
