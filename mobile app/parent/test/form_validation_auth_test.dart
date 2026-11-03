import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/modules/auth/repositories/auth_demo_data.dart';
import 'package:parent_app/modules/auth/screens/register_screen.dart';
import 'package:parent_app/modules/auth/screens/widgets/mobile_number_field.dart';
import 'package:parent_app/utils/mixins/validation_mixins.dart';
import 'helpers/pump_app.dart';

/// Field validation of the sign-in, password reset, passcode and registration forms, driven on the real screens
/// (mock backend). Every check asserts the exact message the guardian sees.

class _V with ValidationMixin {}

/// The [TextFormField] inside the widget with [key] (AppTextField wraps one).
Finder _in(Key key) => find.descendant(of: find.byKey(key), matching: find.byType(TextFormField));

Finder _hint(String hint) => find.widgetWithText(TextFormField, hint);

Future<void> _type(WidgetTester t, Finder f, String text) async {
  await t.ensureVisible(f);
  await t.enterText(f, text);
  await t.pump();
}

Future<void> _tap(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

String _value(WidgetTester t, Finder field) => t.widget<TextFormField>(field).controller!.text;

void main() {
  group('validators (shared rules)', () {
    test('email: required, format, domain labels, trimmed', () {
      final v = _V();
      expect(v.validateEmail(null), 'Email is required');
      expect(v.validateEmail('   '), 'Email is required');
      for (final bad in ['rajesh', 'rajesh@', '@example.com', 'rajesh@example', 'raj esh@example.com', 'a@@b.com', 'a@b..com', 'a@.com', 'a@b.com.']) {
        expect(v.validateEmail(bad), 'Enter a valid email address', reason: bad);
      }
      for (final ok in ['a@b.co', ' rajesh.sharma@example.com ', 'first.last+tag@school.edu.in']) {
        expect(v.validateEmail(ok), isNull, reason: ok);
      }
    });

    test('required: blank and whitespace are missing', () {
      final v = _V();
      expect(v.validateRequired('', 'Password'), 'Password is required');
      expect(v.validateRequired('  ', 'Password'), 'Password is required');
      expect(v.validateRequired('x', 'Password'), isNull);
    });

    test('mobile: 10 digits starting 6-9', () {
      expect(MobileNumberField.validate(''), 'Mobile number is required');
      expect(MobileNumberField.validate(null), 'Mobile number is required');
      for (final bad in ['987654321', '98765432100', '5876543210', '0987654321', '1234567890']) {
        expect(MobileNumberField.validate(bad), 'Enter a valid 10-digit mobile number', reason: bad);
      }
      for (final ok in ['6000000000', '9876543210', '98765 43210']) {
        expect(MobileNumberField.validate(ok), isNull, reason: ok);
      }
    });

    test('date of birth parser: DD/MM/YYYY, real dates only', () {
      expect(parseDmy('14/08/2010'), DateTime(2010, 8, 14));
      expect(parseDmy('1-8-2010'), DateTime(2010, 8, 1));
      expect(parseDmy('14.08.2010'), DateTime(2010, 8, 14));
      expect(parseDmy('29/02/2012'), DateTime(2012, 2, 29)); // leap year
      expect(parseDmy('29/02/2011'), isNull);
      expect(parseDmy('31/04/2012'), isNull);
      expect(parseDmy('2010-08-14'), isNull);
      expect(parseDmy('14/08/10'), isNull);
      expect(parseDmy('00/08/2010'), isNull);
      expect(parseDmy('14/13/2010'), isNull);
    });
  });

  group('Sign in: mobile number', () {
    testWidgets('empty, short, wrong prefix, digits only, 10-digit cap, unlinked, valid', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.login);
      final mobile = find.byKey(const Key('login-mobile'));
      final submit = find.byKey(const Key('login-submit'));

      await _tap(t, submit);
      expect(find.text('Mobile number is required'), findsOneWidget);

      await _type(t, mobile, '987654321'); // 9 digits
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);

      await _type(t, mobile, '5876543210'); // 10 digits, not a mobile prefix
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);

      // letters and symbols are filtered, more than 10 digits are cut off
      await _type(t, mobile, '+91-98765abc');
      expect(t.widget<TextFormField>(mobile).controller!.text, '9198765');
      await _type(t, mobile, '987654321099');
      expect(t.widget<TextFormField>(mobile).controller!.text, '9876543210');

      await _type(t, mobile, '9000000000'); // valid format, not on any admission record
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsNothing);
      expect(find.text('This number is not linked to any admission record.'), findsOneWidget);
      expect(find.text('Verify Mobile Number'), findsNothing);

      await _type(t, mobile, '9876543210');
      await _tap(t, submit);
      expect(find.text('Verify Mobile Number'), findsOneWidget);
    });
  });

  group('Sign in: email and password', () {
    testWidgets('empty, invalid formats, password required, wrong password, valid (trimmed)', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.login);
      await _tap(t, find.text('School ID / Email'));
      final email = _hint('you@example.com'), password = _hint('Your password');
      final submit = find.byKey(const Key('login-submit'));

      await _tap(t, submit);
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);

      for (final bad in ['rajesh', 'rajesh@example', 'rajesh@@example.com', 'raj esh@example.com', 'rajesh@example..com']) {
        await _type(t, email, bad);
        await _tap(t, submit);
        expect(find.text('Enter a valid email address'), findsOneWidget, reason: bad);
      }

      await _type(t, email, DemoData.demoEmail);
      await _type(t, password, '   ');
      await _tap(t, submit);
      expect(find.text('Enter a valid email address'), findsNothing);
      expect(find.text('Password is required'), findsOneWidget);

      await _type(t, password, 'wrong');
      await _tap(t, submit);
      expect(find.text('Password is required'), findsNothing);
      expect(find.text('Incorrect email or password.'), findsOneWidget);

      await _type(t, email, '  ${DemoData.demoEmail.toUpperCase()}  ');
      await _type(t, password, DemoData.demoPassword);
      await _tap(t, submit);
      expect(find.text('Verify Mobile Number'), findsOneWidget);
    });
  });

  group('Forgot password', () {
    testWidgets('empty, invalid, valid sends the link', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.forgotPassword);
      final email = _hint('you@example.com');
      final send = find.text('Send reset link');

      await _tap(t, send);
      expect(find.text('Email is required'), findsOneWidget);

      await _type(t, email, 'rajesh.example.com');
      await _tap(t, send);
      expect(find.text('Enter a valid email address'), findsOneWidget);

      await _type(t, email, 'rajesh@example');
      await _tap(t, send);
      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(find.text('Check your email'), findsNothing);

      await _type(t, email, ' rajesh.sharma@example.com ');
      await _tap(t, send);
      expect(find.text('Check your email'), findsOneWidget);
      expect(find.textContaining('If rajesh.sharma@example.com is registered'), findsOneWidget);
    });
  });

  group('Passcode', () {
    testWidgets('incomplete, digits only, 6-digit cap, wrong code counts down, lockout', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.login);
      await _type(t, find.byKey(const Key('login-mobile')), '9876543210');
      await _tap(t, find.byKey(const Key('login-submit')));
      final field = find.byKey(const Key('otp-field'));
      final verify = find.byKey(const Key('otp-verify'));
      String code() => t.widget<TextField>(field).controller!.text;

      await _tap(t, verify);
      expect(find.text('Enter all 6 digits.'), findsOneWidget);

      await t.enterText(field, '48291'); // 5 digits
      await t.pump();
      await _tap(t, verify);
      expect(find.text('Enter all 6 digits.'), findsOneWidget);
      expect(getIt<AuthBloc>().state.attempts, 0); // never sent

      await t.enterText(field, '4a8-2 9');
      await t.pump();
      expect(code(), '4829'); // digits only

      await t.enterText(field, '00000099'); // capped at 6 digits, then auto-submits on the 6th
      await t.pumpAndSettle();
      expect(code(), isEmpty); // the wrong code is cleared for the next try
      expect(find.text('Incorrect passcode. 2 attempts left.'), findsOneWidget);
      await t.enterText(field, '111111');
      await t.pumpAndSettle();
      expect(find.text('Incorrect passcode. 1 attempt left.'), findsOneWidget);
      await t.enterText(field, '222222');
      await t.pumpAndSettle();
      expect(find.text('Too many attempts. Request a new code.'), findsOneWidget);
      expect(getIt<AuthBloc>().state.attemptsExhausted, isTrue);
      // even the right code is refused until a new one is requested
      getIt<AuthBloc>().add(const OtpSubmitted(AuthDemoData.demoOtp));
      await t.pumpAndSettle();
      expect(getIt<AuthBloc>().state.isAuthenticated, isFalse);
    });

    testWidgets('the right code signs in', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.login);
      await _type(t, find.byKey(const Key('login-mobile')), '9876543210');
      await _tap(t, find.byKey(const Key('login-submit')));
      await t.enterText(find.byKey(const Key('otp-field')), AuthDemoData.demoOtp);
      await t.pumpAndSettle();
      expect(getIt<AuthBloc>().state.isAuthenticated, isTrue);
      expect(find.text('Select Student Profile'), findsOneWidget);
    });
  });

  group('Registration', () {
    final admission = _in(const Key('register-admission-no'));
    final dob = _in(const Key('register-dob'));
    final lookup = find.byKey(const Key('register-lookup'));

    testWidgets('admission number: required, format, accepted variants', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.register);

      await _tap(t, lookup);
      expect(find.text('Admission / scholar no. is required'), findsOneWidget);
      await _type(t, admission, '   ');
      await _tap(t, lookup);
      expect(find.text('Admission / scholar no. is required'), findsOneWidget);

      for (final bad in ['G-2021-0142', 'ABCDE-2021-0142', 'GIS-21-0142', 'GIS-2021-12', 'GIS-2021-123456', 'GIS2021-0142', 'GIS_2021_0142', '2021-0142']) {
        await _type(t, admission, bad);
        await _tap(t, lookup);
        expect(find.text('Use the format GIS-YYYY-####'), findsOneWidget, reason: bad);
      }
      // 2-4 letters, 3-5 digit serial, "-", "/" or space separators
      for (final ok in ['GI-2021-014', 'ABCD-2021-01420', 'gis/2021/0142', 'GIS 2021 0142', ' GIS-2021-0142 ']) {
        await _type(t, admission, ok);
        await _tap(t, lookup);
        expect(find.text('Use the format GIS-YYYY-####'), findsNothing, reason: ok);
      }
    });

    testWidgets('date of birth: required, format, impossible dates, future, today', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.register);
      await _type(t, admission, 'GIS-2021-0142');

      await _tap(t, lookup);
      expect(find.text('Date of birth is required'), findsOneWidget);

      for (final bad in ['2010-08-14', '14/08/10', '14 Aug 2010', '31/02/2012', '29/02/2011', '14/13/2010']) {
        await _type(t, dob, bad);
        await _tap(t, lookup);
        expect(find.text('Enter the date as DD/MM/YYYY'), findsOneWidget, reason: bad);
      }

      final now = DateTime.now();
      await _type(t, dob, formatDmy(DateTime(now.year, now.month, now.day + 1)));
      await _tap(t, lookup);
      expect(find.text('Date of birth cannot be in the future'), findsOneWidget);

      // today is the last accepted day; it reaches the school record (which does not match)
      await _type(t, dob, formatDmy(now));
      await _tap(t, lookup);
      expect(find.text('Date of birth cannot be in the future'), findsNothing);
      expect(find.text('Date of birth does not match the admission record.'), findsOneWidget);

      // a valid slip that is not on record
      await _type(t, admission, 'GIS-2020-9999');
      await _type(t, dob, '14/08/2010');
      await _tap(t, lookup);
      expect(find.text('No admission record found for GIS-2020-9999.'), findsOneWidget);

      // the real record (lower case and slashes are normalised); adding it again is refused
      await _type(t, admission, 'gis/2021/0142');
      await _type(t, dob, '14/08/2010');
      await _tap(t, lookup);
      expect(find.text('VERIFIED STUDENT MATCH'), findsOneWidget);
      expect(find.text('Aarav Sharma'), findsOneWidget);
      expect(_value(t, admission), isEmpty); // cleared for the next child
      await _type(t, admission, 'GIS-2021-0142');
      await _type(t, dob, '14/08/2010');
      await _tap(t, lookup);
      expect(find.text('GIS-2021-0142 is already added.'), findsOneWidget);
      expect(find.text('VERIFIED STUDENT MATCH'), findsOneWidget);
    });

    testWidgets('guardian: name length and letters, relation, mobile, declaration, student needed', (t) async {
      await setUpTestApp();
      await pumpApp(t, location: RoutePaths.register);
      final name = _in(const Key('register-name'));
      final mobile = find.byKey(const Key('register-mobile'));
      final submit = find.byKey(const Key('register-submit'));

      await _tap(t, submit);
      expect(find.text('Enter the full name'), findsOneWidget);
      expect(find.text('Choose your relationship'), findsOneWidget);
      expect(find.text('Mobile number is required'), findsOneWidget);
      expect(find.text('Please accept the declaration'), findsOneWidget);

      await _type(t, name, '  Al  '); // 2 letters after trimming
      await _tap(t, submit);
      expect(find.text('Enter the full name'), findsOneWidget);
      await _type(t, name, '12345');
      await _tap(t, submit);
      expect(find.text('Use letters only'), findsOneWidget);
      await _type(t, name, 'Priya_Sharma!');
      await _tap(t, submit);
      expect(find.text('Use letters only'), findsOneWidget);
      await _type(t, name, 'Ali'); // 3 letters: the minimum
      await _tap(t, submit);
      expect(find.text('Enter the full name'), findsNothing);
      expect(find.text('Use letters only'), findsNothing);
      await _type(t, name, "Mrs. D'Souza-Sharma");
      await _tap(t, submit);
      expect(find.text('Use letters only'), findsNothing);

      await _tap(t, find.text('Mother'));
      expect(find.text('Choose your relationship'), findsNothing);

      await _type(t, mobile, '98765432');
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
      await _type(t, mobile, '4876543210');
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
      await _type(t, mobile, '9876543210');

      await _tap(t, find.byKey(const Key('register-declare')));
      await _tap(t, submit);
      expect(find.text('Enter a valid 10-digit mobile number'), findsNothing);
      expect(find.text('Please accept the declaration'), findsNothing);
      // every guardian field is fine, but no student was verified yet
      expect(find.text('Verify at least one student first.'), findsOneWidget);

      // verify a student, then the same form submits
      await _type(t, admission, 'GIS-2023-0318');
      await _type(t, dob, '22/03/2012');
      await _tap(t, lookup);
      expect(find.text('VERIFIED STUDENT MATCH'), findsOneWidget);
      await _tap(t, submit);
      expect(find.text('Registration submitted'), findsOneWidget);
      expect(find.textContaining("Mrs. D'Souza-Sharma (Mother)"), findsOneWidget);
      expect(find.textContaining('+91 98765 43210'), findsOneWidget);
    });
  });
}
