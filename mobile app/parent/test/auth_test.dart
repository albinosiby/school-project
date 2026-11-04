import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/config/routes/routes_config.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/modules/auth/bloc/registration_bloc.dart';
import 'package:parent_app/modules/auth/repositories/auth_demo_data.dart';
import 'package:parent_app/modules/auth/repositories/auth_repository_interface.dart';
import 'package:parent_app/modules/auth/repositories/mock_auth_repository.dart';
import 'package:parent_app/modules/auth/repositories/mock_registration_repository.dart';
import 'package:parent_app/modules/auth/repositories/registration_repository_interface.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/utils/services/local_storage_service.dart';
import 'helpers/pump_app.dart';

const _mobile = '9876543210';

/// Location of the top-most page (pushed pages included).
String _location(WidgetTester t) {
  final config = GoRouter.of(
    t.element(find.byType(Overlay).first),
  ).routerDelegate.currentConfiguration;
  return config.last.matchedLocation;
}

Future<AuthState> _next(AuthBloc b, bool Function(AuthState) test) =>
    b.stream.firstWhere(test);

void main() {
  group('AuthBloc sign-in', () {
    test(
      'mobile -> passcode -> signed in; wrong code counts attempts',
      () async {
        await setUpTestApp();
        final bloc = getIt<AuthBloc>();
        expect(bloc.state.status, AuthStatus.unauthenticated);

        bloc.add(const MobileOtpRequested(_mobile));
        final sent = await _next(bloc, (s) => s.status == AuthStatus.otpSent);
        expect(sent.challenge?.phone, DemoData.guardian.phone);
        expect(sent.isAuthenticated, isFalse);

        bloc.add(const OtpSubmitted('000000'));
        final wrong = await _next(bloc, (s) => s.error != null);
        expect(wrong.attempts, 1);
        expect(wrong.error, contains('2 attempts left'));
        expect(wrong.status, AuthStatus.otpSent);

        bloc.add(const OtpSubmitted(AuthDemoData.demoOtp));
        final inn = await _next(bloc, (s) => s.isAuthenticated);
        expect(inn.guardian?.name, 'Mr. Rajesh Sharma');
        expect(inn.challenge, isNull);
      },
    );

    test('an unlinked mobile number is rejected', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()
        ..add(const MobileOtpRequested('9000000000'));
      final s = await _next(bloc, (s) => s.error != null);
      expect(s.status, AuthStatus.unauthenticated);
      expect(s.error, contains('not linked'));
    });

    test('email + password sends a passcode; wrong password errors', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()
        ..add(const LoginSubmitted(DemoData.demoEmail, 'nope'));
      expect(
        (await _next(bloc, (s) => s.error != null)).error,
        contains('Incorrect'),
      );

      bloc.add(const LoginSubmitted(DemoData.demoEmail, DemoData.demoPassword));
      await _next(bloc, (s) => s.status == AuthStatus.otpSent);
      bloc.add(const OtpSubmitted(AuthDemoData.demoOtp));
      await _next(bloc, (s) => s.isAuthenticated);
    });

    test(
      'three wrong codes lock the passcode until a new one is sent',
      () async {
        await setUpTestApp();
        final bloc = getIt<AuthBloc>()..add(const MobileOtpRequested(_mobile));
        final first = await _next(bloc, (s) => s.status == AuthStatus.otpSent);
        for (var i = 1; i <= 3; i++) {
          bloc.add(const OtpSubmitted('111111'));
          await _next(bloc, (s) => s.attempts == i);
        }
        expect(bloc.state.attemptsExhausted, isTrue);
        expect(bloc.state.error, contains('Too many attempts'));
        // Even the right code is refused now.
        bloc.add(const OtpSubmitted(AuthDemoData.demoOtp));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.isAuthenticated, isFalse);

        bloc.add(const OtpResendRequested(OtpChannel.whatsapp));
        final again = await _next(
          bloc,
          (s) => s.challenge != null && s.challenge!.id != first.challenge!.id,
        );
        expect(again.attempts, 0);
        expect(again.challenge!.channel, OtpChannel.whatsapp);
        bloc.add(const OtpSubmitted(AuthDemoData.demoOtp));
        await _next(bloc, (s) => s.isAuthenticated);
      },
    );

    test('cancelling the passcode step forgets the challenge', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()..add(const MobileOtpRequested(_mobile));
      await _next(bloc, (s) => s.status == AuthStatus.otpSent);
      bloc.add(const OtpCancelled());
      final s = await _next(bloc, (s) => s.challenge == null);
      expect(s.status, AuthStatus.unauthenticated);
    });

    test('Google / Apple sign in the demo guardian (simulated)', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()
        ..add(const SocialSignInRequested(SocialProvider.apple));
      final s = await _next(bloc, (s) => s.isAuthenticated);
      expect(s.provider, SocialProvider.apple);
      expect(s.guardian?.id, DemoData.guardian.id);
      expect(await getIt<IAuthRepository>().currentGuardian(), isNotNull);
    });

    test('saved session is restored and logout clears it', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<AuthBloc>();
      expect(bloc.state.isAuthenticated, isTrue);
      bloc.add(const LogoutRequested());
      await _next(bloc, (s) => s.status == AuthStatus.unauthenticated);
      expect(await getIt<IAuthRepository>().currentGuardian(), isNull);
    });

    test('forgot password validates the email', () async {
      await setUpTestApp();
      final bloc = getIt<AuthBloc>()..add(const PasswordResetRequested('bad'));
      expect(
        (await _next(bloc, (s) => s.reset == ResetStatus.failed)).resetError,
        isNotNull,
      );
      bloc.add(const PasswordResetRequested(DemoData.demoEmail));
      await _next(bloc, (s) => s.reset == ResetStatus.sent);
    });
  });

  test('an expired passcode is refused', () async {
    await setUpTestApp();
    var now = DateTime(2026, 10, 27, 9);
    final repo = MockAuthRepository(
      getIt<LocalStorageService>(),
      clock: () => now,
    );
    final c = await repo.requestOtpForMobile(_mobile);
    now = now.add(const Duration(minutes: 11));
    expect(
      () => repo.verifyOtp(c, AuthDemoData.demoOtp),
      throwsA(predicate((e) => '$e'.contains('expired'))),
    );
  });

  group('registration', () {
    test(
      'lookup normalises the admission number and checks the date of birth',
      () async {
        await setUpTestApp();
        final repo = getIt<IRegistrationRepository>();
        final m = await repo.lookupStudent(
          'gis/2021/0142',
          DateTime(2010, 8, 14),
        );
        expect(m.name, 'Aarav Sharma');
        expect(
          () => repo.lookupStudent('GIS-2021-0142', DateTime(2010, 8, 15)),
          throwsA(predicate((e) => '$e'.contains('Date of birth'))),
        );
        expect(
          () => repo.lookupStudent('GIS-1999-0001', DateTime(2010, 8, 14)),
          throwsA(predicate((e) => '$e'.contains('No admission record'))),
        );
      },
    );

    test(
      'bloc adds, rejects duplicates, removes and submits a pending registration',
      () async {
        await setUpTestApp();
        final bloc = getIt<RegistrationBloc>();
        bloc.add(
          const RegistrationSubmitted(
            guardianName: 'Mrs. Priya Sharma',
            relation: 'Mother',
            phone: _mobile,
          ),
        );
        expect(
          (await bloc.stream.firstWhere(
            (s) => s.submit == SubmitStatus.failed,
          )).submitError,
          contains('at least one'),
        );

        bloc.add(
          StudentLookupRequested('GIS-2021-0142', DateTime(2010, 8, 14)),
        );
        await bloc.stream.firstWhere((s) => s.students.length == 1);
        bloc.add(
          StudentLookupRequested('gis-2021-0142', DateTime(2010, 8, 14)),
        );
        expect(
          (await bloc.stream.firstWhere(
            (s) => s.lookup == LookupStatus.failed,
          )).lookupError,
          contains('already added'),
        );
        bloc.add(
          StudentLookupRequested('GIS-2023-0318', DateTime(2012, 3, 22)),
        );
        await bloc.stream.firstWhere((s) => s.students.length == 2);
        bloc.add(const StudentRemoved('GIS-2021-0142'));
        await bloc.stream.firstWhere((s) => s.students.length == 1);

        bloc.add(
          const RegistrationSubmitted(
            guardianName: ' Mrs. Priya Sharma ',
            relation: 'Mother',
            phone: '98765 43210',
          ),
        );
        final done = await bloc.stream.firstWhere(
          (s) => s.submit == SubmitStatus.submitted,
        );
        expect(done.result!.reference, startsWith('REG-'));
        expect(done.result!.request.guardianName, 'Mrs. Priya Sharma');
        expect(done.result!.request.students.single.name, 'Ananya Sharma');
        final repo =
            getIt<IRegistrationRepository>() as MockRegistrationRepository;
        expect(repo.pending, hasLength(1));
      },
    );
  });

  test(
    'redirect guard: onboarding routes are public, select child is not',
    () async {
      await setUpTestApp();
      for (final p in [
        RoutePaths.welcome,
        RoutePaths.login,
        RoutePaths.loginOtp,
        RoutePaths.forgotPassword,
        RoutePaths.register,
      ]) {
        expect(RoutePaths.isPublic(p), isTrue, reason: p);
      }
      expect(RoutePaths.isPublic(RoutePaths.selectChild), isFalse);
      expect(RoutePaths.isPublic(RoutePaths.signedOutHome), isTrue);
      expect(RoutePaths.isPublic(RoutePaths.signedInHome), isFalse);

      final out = getIt<AuthBloc>().state;
      expect(RoutePaths.isPublic(authRedirect(out, '/home')!), isTrue);
      expect(authRedirect(out, RoutePaths.register), isNull);
      expect(authRedirect(out, RoutePaths.selectChild), isNotNull);

      getIt<AuthBloc>().add(const SocialSignInRequested(SocialProvider.google));
      final inn = await getIt<AuthBloc>().stream.firstWhere(
        (s) => s.isAuthenticated,
      );
      expect(authRedirect(inn, RoutePaths.welcome), isNotNull);
      expect(authRedirect(inn, RoutePaths.selectChild), isNull);
    },
  );

  group('screens', () {
    testWidgets('welcome -> sign in -> passcode -> select child -> home', (
      t,
    ) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.welcome);
      expect(find.text('Welcome to Edvio'), findsOneWidget);

      await t.tap(find.byKey(const Key('welcome-sign-in')));
      await t.pumpAndSettle();
      expect(find.text('Welcome Back'), findsOneWidget);
      await t.tap(find.text('Demo family'));
      await t.pump();
      await t.tap(find.byKey(const Key('login-submit')));
      await t.pumpAndSettle();

      expect(find.text('Verify Mobile Number'), findsOneWidget);
      expect(find.text(DemoData.guardian.phone), findsOneWidget);
      await t.ensureVisible(find.byKey(const Key('otp-demo-hint')));
      await t.tap(find.byKey(const Key('otp-demo-hint')));
      await t.pump();
      await t.ensureVisible(find.byKey(const Key('otp-verify')));
      await t.tap(find.byKey(const Key('otp-verify')));
      await t.pumpAndSettle();

      expect(_location(t), RoutePaths.selectChild);
      expect(find.text('Select Student Profile'), findsOneWidget);
      expect(find.text('REGISTERED DEPENDENTS (2)'), findsOneWidget);
      await t.tap(find.byKey(ValueKey('select-child-${DemoData.ananya.id}')));
      await t.pump();
      expect(find.text('Continue with Ananya Sharma'), findsOneWidget);
      await t.tap(find.byKey(const Key('select-child-continue')));
      await t.pumpAndSettle();

      expect(_location(t), startsWith(RoutePaths.home));
      expect(getIt<FamilyBloc>().state.selected?.id, DemoData.ananya.id);
    });

    testWidgets('welcome: Google quick access, register link and helpdesk', (
      t,
    ) async {
      final launcher = await setUpTestApp();
      await pumpApp(t, location: RoutePaths.welcome);

      await t.tap(find.text('Contact Campus Helpdesk'));
      await t.pumpAndSettle();
      expect(launcher.opened, [AuthDemoData.helpdeskTel]);
      expect(find.textContaining('Calling Campus Helpdesk'), findsOneWidget);

      await t.tap(find.byKey(const Key('welcome-register')));
      await t.pumpAndSettle();
      expect(find.text('Admission Verification'), findsOneWidget);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();
      expect(find.text('Welcome to Edvio'), findsOneWidget);

      await t.tap(find.byKey(const ValueKey('social-google')));
      await t.pumpAndSettle();
      expect(find.textContaining('Signed in with Google'), findsOneWidget);
      expect(find.text('Select Student Profile'), findsOneWidget);
      expect(getIt<AuthBloc>().state.isAuthenticated, isTrue);
    });

    testWidgets(
      'login validates both tabs and shows errors; forgot password works',
      (t) async {
        await setUpTestApp();
        await pumpApp(t, location: RoutePaths.login);

        await t.tap(find.byKey(const Key('login-submit')));
        await t.pumpAndSettle();
        expect(find.text('Mobile number is required'), findsOneWidget);
        await t.enterText(find.byKey(const Key('login-mobile')), '9000000000');
        await t.tap(find.byKey(const Key('login-submit')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('login-error')), findsOneWidget);
        expect(find.text('Verify Mobile Number'), findsNothing);

        await t.tap(find.text('School ID / Email'));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('login-error')), findsNothing);
        await t.tap(find.byKey(const Key('login-submit')));
        await t.pumpAndSettle();
        expect(find.text('Email is required'), findsOneWidget);
        await t.enterText(
          find.widgetWithText(TextFormField, 'you@example.com'),
          DemoData.demoEmail,
        );
        await t.enterText(
          find.widgetWithText(TextFormField, 'Your password'),
          'wrong',
        );
        await t.tap(find.byKey(const Key('login-submit')));
        await t.pumpAndSettle();
        expect(find.text('Incorrect email or password.'), findsOneWidget);

        await t.tap(find.text('Forgot password?'));
        await t.pumpAndSettle();
        await t.enterText(
          find.widgetWithText(TextFormField, 'you@example.com'),
          DemoData.demoEmail,
        );
        await t.tap(find.text('Send reset link'));
        await t.pumpAndSettle();
        expect(find.text('Check your email'), findsOneWidget);
      },
    );

    testWidgets('passcode screen: wrong code, resend channels, edit number', (
      t,
    ) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.login);
      await t.enterText(find.byKey(const Key('login-mobile')), _mobile);
      await t.tap(find.byKey(const Key('login-submit')));
      await t.pumpAndSettle();

      await t.ensureVisible(find.byKey(const Key('otp-verify')));

      await t.tap(find.byKey(const Key('otp-verify')));
      await t.pump();
      expect(find.text('Enter all 6 digits.'), findsOneWidget);

      await t.enterText(find.byKey(const Key('otp-field')), '123456');
      await t.pumpAndSettle(); // auto-submits on the 6th digit
      expect(find.textContaining('Incorrect passcode'), findsOneWidget);
      expect(find.text('Attempt 2 of 3'), findsOneWidget);

      expect(find.byKey(const Key('otp-countdown')), findsOneWidget);
      await t.ensureVisible(find.text('Via WhatsApp'));
      await t.tap(find.text('Via WhatsApp'));
      await t.pumpAndSettle();
      expect(find.text('A new passcode was sent on WhatsApp'), findsOneWidget);
      expect(find.text('Dispatched via WhatsApp'), findsOneWidget);
      expect(find.text('Attempt 1 of 3'), findsOneWidget);

      await t.pump(const Duration(seconds: 41));
      await t.pumpAndSettle();
      await t.ensureVisible(find.byKey(const Key('otp-resend')));
      await t.tap(find.byKey(const Key('otp-resend')));
      await t.pumpAndSettle();
      expect(find.text('A new passcode was sent by SMS'), findsOneWidget);

      await t.ensureVisible(find.byKey(const Key('otp-edit')));

      await t.tap(find.byKey(const Key('otp-edit')));
      await t.pumpAndSettle();
      expect(find.text('Welcome Back'), findsOneWidget);
      expect(getIt<AuthBloc>().state.challenge, isNull);
    });

    testWidgets('passcode screen without a pending sign-in offers sign in', (
      t,
    ) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.loginOtp);
      expect(find.text('No passcode requested'), findsOneWidget);
      await t.tap(find.text('Go to sign in'));
      await t.pumpAndSettle();
      expect(find.text('Welcome Back'), findsOneWidget);
    });

    testWidgets('registration: validates, verifies students, submits', (
      t,
    ) async {
      final launcher = await setUpTestApp();
      await pumpApp(t, location: RoutePaths.register);
      expect(find.text('Admission Verification'), findsOneWidget);

      // Lookup validation + a failing lookup.
      await t.tap(find.byKey(const Key('register-lookup')));
      await t.pumpAndSettle();
      expect(find.text('Admission / scholar no. is required'), findsOneWidget);
      expect(find.text('Date of birth is required'), findsOneWidget);
      await t.enterText(
        find.descendant(
          of: find.byKey(const Key('register-admission-no')),
          matching: find.byType(TextFormField),
        ),
        'GIS-2021-0142',
      );
      await t.enterText(
        find.descendant(
          of: find.byKey(const Key('register-dob')),
          matching: find.byType(TextFormField),
        ),
        '01/01/2011',
      );
      await t.tap(find.byKey(const Key('register-lookup')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('register-lookup-error')), findsOneWidget);

      // Scan QR (simulated) fills Aarav's slip.
      await t.tap(find.byKey(const Key('register-scan-qr')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('register-lookup')));
      await t.pumpAndSettle();
      expect(find.text('VERIFIED STUDENT MATCH'), findsOneWidget);
      expect(find.text('Aarav Sharma'), findsOneWidget);
      expect(find.text('Add Student'), findsOneWidget);

      // Add a second student, then remove it.
      await t.tap(find.byKey(const Key('register-scan-qr')));
      await t.pumpAndSettle();
      await t.ensureVisible(find.byKey(const Key('register-lookup')));
      await t.tap(find.byKey(const Key('register-lookup')));
      await t.pumpAndSettle();
      expect(find.text('VERIFIED STUDENT MATCH'), findsNWidgets(2));
      await t.ensureVisible(find.byTooltip('Remove Ananya Sharma'));
      await t.tap(find.byTooltip('Remove Ananya Sharma'));
      await t.pumpAndSettle();
      expect(find.text('VERIFIED STUDENT MATCH'), findsOneWidget);

      // Guardian validation.
      await t.ensureVisible(find.byKey(const Key('register-submit')));
      await t.tap(find.byKey(const Key('register-submit')));
      await t.pumpAndSettle();
      expect(find.text('Enter the full name'), findsOneWidget);
      expect(find.text('Choose your relationship'), findsOneWidget);
      expect(find.text('Mobile number is required'), findsOneWidget);
      expect(find.text('Please accept the declaration'), findsOneWidget);

      await t.enterText(
        find.descendant(
          of: find.byKey(const Key('register-name')),
          matching: find.byType(TextFormField),
        ),
        'Mrs. Priya Sharma',
      );
      await t.ensureVisible(find.text('Mother'));
      await t.tap(find.text('Mother'));
      await t.enterText(find.byKey(const Key('register-mobile')), _mobile);
      await t.ensureVisible(find.byKey(const Key('register-declare')));
      await t.tap(find.byKey(const Key('register-declare')));
      await t.pump();
      await t.ensureVisible(find.byKey(const Key('register-submit')));
      await t.tap(find.byKey(const Key('register-submit')));
      await t.pumpAndSettle();

      expect(find.text('Registration submitted'), findsOneWidget);
      expect(find.byKey(const Key('register-reference')), findsOneWidget);
      expect(find.text('Pending verification'), findsOneWidget);
      expect(find.textContaining('Mrs. Priya Sharma (Mother)'), findsOneWidget);
      expect(launcher.opened, isEmpty);

      await t.tap(find.text('Go to Sign In'));
      await t.pumpAndSettle();
      expect(find.text('Welcome Back'), findsOneWidget);
    });
  });
}
