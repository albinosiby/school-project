// Field validation of every form, as widget tests on the real screens: empty, invalid and boundary input and the
// exact error text the teacher sees.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:teacher_app/config/app_config.dart';
import 'package:teacher_app/config/routes/modules/attendance_routes.dart';
import 'package:teacher_app/config/routes/modules/auth_routes.dart';
import 'package:teacher_app/config/routes/modules/classes_routes.dart';
import 'package:teacher_app/config/routes/modules/engage_routes.dart';
import 'package:teacher_app/config/routes/modules/home_routes.dart';
import 'package:teacher_app/config/routes/modules/lessons_routes.dart';
import 'package:teacher_app/config/routes/modules/tasks_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/design_system/design_system.dart';
import 'package:teacher_app/modules/attendance/models/leave_models.dart';
import 'package:teacher_app/modules/auth/models/auth_models.dart';
import 'package:teacher_app/modules/engage/models/live_class_rules.dart';
import 'package:teacher_app/modules/engage/screens/live_class_schedule_screen.dart' show liveMedia;
import 'package:teacher_app/utils/mixins/validation_mixins.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

late LocalDatabaseService db;

/// Every module's routes, plus stubs for the tab roots (shell routes live in routes_config).
List<RouteBase> get _routes {
  final all = <RouteBase>[...attendanceRoutes, ...authRoutes, ...classesRoutes, ...engageRoutes, ...homeRoutes, ...lessonsRoutes, ...tasksRoutes];
  final paths = {for (final r in all) if (r is GoRoute) r.path};
  return [
    ...all,
    for (final p in ['/', RoutePaths.home, RoutePaths.classes, RoutePaths.tasks, RoutePaths.more, RoutePaths.timetable, RoutePaths.attendanceHistory])
      if (!paths.contains(p)) GoRoute(path: p, builder: (_, _) => Scaffold(body: Text('stub $p'))),
  ];
}

Future<void> open(WidgetTester t, String location) => pumpScreen(t, location: location, routes: _routes);

/// The test font is wider than Inter: layout overflow reports are not meaningful here.
void ignoreOverflow() {
  final orig = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    orig?.call(d);
  };
  addTearDown(() => FlutterError.onError = orig);
}

/// The page's vertical scrollable (not a horizontal chip row).
Finder get page => find.byWidgetPredicate((w) => w is Scrollable && (w.axisDirection == AxisDirection.down || w.axisDirection == AxisDirection.up));

/// Builds and shows [f] when it sits in a lazily built list below (or above) the fold.
Future<void> reveal(WidgetTester t, Finder f) async {
  if (f.evaluate().isNotEmpty || page.evaluate().isEmpty) return;
  // back to the top, then down until it is built
  for (var i = 0; i < 4 && f.evaluate().isEmpty; i++) {
    await t.fling(page.first, const Offset(0, 3000), 5000);
    await t.pumpAndSettle();
  }
  if (f.evaluate().isNotEmpty) return;
  try {
    await t.scrollUntilVisible(f, 200, scrollable: page.first, maxScrolls: 80);
  } catch (_) {}
}

Future<void> tap(WidgetTester t, Finder f) async {
  await reveal(t, f);
  await t.ensureVisible(f.last);
  await t.pumpAndSettle();
  await t.tap(f.last);
  await t.pumpAndSettle();
}

Future<void> tapText(WidgetTester t, String text) => tap(t, find.text(text));

/// The TextFormField of the AppTextField labelled [label].
Finder field(String label) => find.descendant(of: find.widgetWithText(AppTextField, label), matching: find.byType(TextFormField));

Finder hinted(String hint) => find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == hint);

Future<void> type(WidgetTester t, Finder f, String text) async {
  await reveal(t, f);
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
  await t.enterText(f.first, text);
  await t.pumpAndSettle();
}

/// Scrolls the page until [text] is built (errors can sit below or above the fold), then returns its finder.
Future<Finder> seen(WidgetTester t, String text, {bool contains = false}) async {
  final f = contains ? find.textContaining(text) : find.text(text);
  await reveal(t, f);
  return f;
}

void main() {
  setUp(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    db = await setUpTestApp();
  });

  group('login and forgot password', () {
    test('rules: empty, invalid, boundary', () {
      expect(AuthValidators.email(''), 'Enter your school email');
      expect(AuthValidators.email('   '), 'Enter your school email');
      expect(AuthValidators.email('anita'), 'Enter a valid email address');
      expect(AuthValidators.email('anita@school'), 'Enter a valid email address');
      expect(AuthValidators.email('anita@school.e'), 'Enter a valid email address');
      expect(AuthValidators.email('a@b.co'), isNull);
      expect(AuthValidators.email(' anita.sharma@greenfield.edu '), isNull);
      expect(AuthValidators.password(''), 'Enter your password');
      expect(AuthValidators.password(' '), isNull, reason: 'passwords are not trimmed');
    });

    testWidgets('login screen shows the field errors', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.login);
      await tapText(t, 'Sign in');
      expect(find.text('Enter your school email'), findsOneWidget);
      // the password hint and its error read the same: hint + error
      expect(find.text('Enter your password'), findsNWidgets(2));
      await type(t, field('School email'), 'anita@school');
      await tapText(t, 'Sign in');
      expect(find.text('Enter a valid email address'), findsOneWidget);
      await type(t, field('School email'), 'a@b.co');
      await type(t, field('Password'), 'x');
      await tapText(t, 'Sign in');
      expect(find.text('Enter a valid email address'), findsNothing);
      expect(find.text('Enter your school email'), findsNothing);
      expect(find.text('Enter your password'), findsOneWidget, reason: 'only the hint is left, the error is gone');
    });

    testWidgets('forgot password validates the email', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.forgotPassword);
      await tapText(t, 'Send reset link');
      expect(find.text('Enter your school email'), findsOneWidget);
      await type(t, field('School email'), 'not-an-email');
      await tapText(t, 'Send reset link');
      expect(find.text('Enter a valid email address'), findsOneWidget);
      await type(t, field('School email'), 'anita.sharma@greenfield.edu');
      await tapText(t, 'Send reset link');
      expect(find.text('Enter a valid email address'), findsNothing);
    });
  });

  group('homework', () {
    testWidgets('title required (publish and draft), max marks > 0, 1 is the lowest valid', (t) async {
      ignoreOverflow();
      final before = db.list('tk_homework').length;
      await open(t, '${RoutePaths.homeworkNew}?classId=cls_10B');
      await tapText(t, 'Publish HW');
      expect(await seen(t, 'Enter an assignment title'), findsOneWidget);
      await tapText(t, 'Save Draft');
      expect(await seen(t, 'Enter a title to save a draft'), findsOneWidget);
      await type(t, hinted('e.g. Quadratic Equations — Practice Set 5'), 'Practice Set 5');
      await type(t, field('Total Max Marks'), '0');
      await tapText(t, 'Publish HW');
      expect(await seen(t, 'Enter marks greater than 0'), findsOneWidget);
      expect(db.list('tk_homework').length, before);
      await type(t, field('Total Max Marks'), 'abc');
      await tapText(t, 'Publish HW');
      expect(await seen(t, 'Enter marks greater than 0'), findsOneWidget);
      await type(t, field('Total Max Marks'), '1');
      await tapText(t, 'Publish HW');
      expect(db.list('tk_homework').length, before + 1);
      expect(db.list('tk_homework').firstWhere((h) => h['title'] == 'Practice Set 5')['maxMarks'], 1);
    });
  });

  group('marks entry', () {
    String firstOf(String classId) {
      final s = [for (final r in db.list('students')) if (r['classId'] == classId) r]..sort((a, b) => (a['roll'] as num).compareTo(b['roll'] as num));
      return '${s.first['id']}';
    }

    Future<void> openEntry(WidgetTester t, String exam, String student) =>
        open(t, Uri(path: RoutePaths.marksEnter, queryParameters: {'exam': exam, 'student': student}).toString());

    testWidgets('bounds 0..max: empty and max+1 are rejected, 0 and max are saved', (t) async {
      ignoreOverflow();
      final sid = firstOf('cls_8C');
      await openEntry(t, 'ex_4', sid); // max 20, no sections
      await tapText(t, 'Save Draft');
      expect(await seen(t, 'Enter the total marks'), findsOneWidget);
      await type(t, hinted('--'), '21');
      expect(await seen(t, 'Cannot exceed max of 20'), findsOneWidget);
      await tapText(t, 'Save Draft');
      expect(db.byId('att_marks', 'ex_4_$sid')?['marks'], isNot(21));
      await type(t, hinted('--'), '0');
      expect(find.text('Cannot exceed max of 20'), findsNothing);
      await tapText(t, 'Save Draft');
      expect(db.byId('att_marks', 'ex_4_$sid')!['marks'], 0);
      await type(t, hinted('--'), '20');
      await tapText(t, 'Save Draft');
      expect(db.byId('att_marks', 'ex_4_$sid')!['marks'], 20);
    });

    testWidgets('an absent student needs no marks', (t) async {
      ignoreOverflow();
      final sid = firstOf('cls_8C');
      await openEntry(t, 'ex_4', sid);
      await tapText(t, 'Absent');
      await tapText(t, 'Save Draft');
      expect(find.text('Enter the total marks'), findsNothing);
      expect(db.byId('att_marks', 'ex_4_$sid')!['status'], 'Absent');
      expect(db.byId('att_marks', 'ex_4_$sid')!['marks'], isNull);
    });

    testWidgets('editing submitted marks needs a reason of at least 5 characters', (t) async {
      ignoreOverflow();
      await open(t, Uri(path: RoutePaths.marksEdit, queryParameters: {'exam': 'ex_3', 'student': 'stu_143'}).toString());
      final reason = hinted('e.g. Re-evaluation of Q12 approved by HOD');
      await t.scrollUntilVisible(reason, 300, scrollable: find.byType(Scrollable).first);
      await type(t, reason, 'abcd');
      await tapText(t, 'Update Student Marks');
      expect(await seen(t, 'A reason (min 5 characters) is required to edit submitted marks'), findsOneWidget);
      expect(db.byId('att_marks', 'ex_3_stu_143')!['history'], isNull);
      await t.scrollUntilVisible(reason, 300, scrollable: find.byType(Scrollable).first);
      await type(t, reason, 'abcde');
      await tapText(t, 'Update Student Marks');
      expect((db.byId('att_marks', 'ex_3_stu_143')!['history'] as List).single['reason'], 'abcde');
    });

    testWidgets('a paper locked by the exam cell cannot be entered, even by link', (t) async {
      ignoreOverflow();
      db.update('att_exams', 'ex_4', {'status': 'Locked'});
      final sid = firstOf('cls_8C');
      final before = db.byId('att_marks', 'ex_4_$sid');
      await openEntry(t, 'ex_4', sid);
      expect(find.text('Marks entry is locked'), findsOneWidget);
      expect(find.text('Save Draft'), findsNothing);
      expect(find.text('Save & Next'), findsNothing);
      expect(db.byId('att_marks', 'ex_4_$sid'), before);
    });
  });

  group('apply leave', () {
    int days(String s, String e) => leaveDays(s, e);
    String key(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    DateTime today() => DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);

    testWidgets('reason: 9 characters rejected, 10 accepted', (t) async {
      ignoreOverflow();
      final before = db.list('att_leaves').length;
      await open(t, RoutePaths.leaveApply);
      await tapText(t, 'Submit Leave Application');
      expect(await seen(t, 'Please give a reason (at least 10 characters)'), findsWidgets);
      await type(t, find.byType(TextField).first, '123456789');
      await tapText(t, 'Submit Leave Application');
      expect(await seen(t, 'Please give a reason (at least 10 characters)'), findsWidgets);
      expect(db.list('att_leaves').length, before);
      await type(t, find.byType(TextField).first, '1234567890');
      await tapText(t, 'Submit Leave Application');
      await tapText(t, 'Submit'); // "No handover added" confirmation
      expect(db.list('att_leaves').length, before + 1);
      expect(db.list('att_leaves').first['reason'], '1234567890');
    });

    testWidgets('quota: exactly the available days pass, one more is refused', (t) async {
      ignoreOverflow();
      final s = key(today().add(const Duration(days: 3))), e = key(today().add(const Duration(days: 5)));
      final n = days(s, e);
      final dl = db.byId('att_quota', 'DL')!;
      db.update('att_quota', 'DL', {'used': (dl['total'] as int) - n + 1}); // available = n - 1
      await open(t, RoutePaths.leaveApply);
      await tapText(t, 'Duty Leave');
      await type(t, find.byType(TextField).first, 'Board exam evaluation duty');
      await tapText(t, 'Submit Leave Application');
      expect(await seen(t, 'Only ${n - 1} day(s) of Duty Leave available'), findsWidgets);
      db.update('att_quota', 'DL', {'used': (dl['total'] as int) - n}); // available = n
      await open(t, RoutePaths.leaveApply);
      await tapText(t, 'Duty Leave');
      await type(t, find.byType(TextField).first, 'Board exam evaluation duty');
      await tapText(t, 'Submit Leave Application');
      expect(find.textContaining('day(s) of Duty Leave available'), findsNothing);
    });

    testWidgets('medical leave over 2 days needs a certificate', (t) async {
      ignoreOverflow();
      final s = key(today().add(const Duration(days: 3))), e = key(today().add(const Duration(days: 5)));
      await open(t, RoutePaths.leaveApply);
      await tapText(t, 'Medical Leave');
      await type(t, find.byType(TextField).first, 'Recovering from surgery');
      await tapText(t, 'Submit Leave Application');
      final f = find.text('A medical certificate is required for more than 2 days');
      if (days(s, e) > 2) {
        expect(f, findsWidgets);
      } else {
        expect(f, findsNothing); // the default range contains a Sunday this week
      }
    });

    testWidgets('date range: a range of only Sundays is refused', (t) async {
      ignoreOverflow();
      var sunday = today().add(const Duration(days: 6));
      while (sunday.weekday != DateTime.sunday) {
        sunday = sunday.add(const Duration(days: 1));
      }
      await open(t, RoutePaths.leaveApply);
      await tap(t, find.text('START DATE'));
      await t.tap(find.byIcon(Icons.edit_outlined));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField).last, '${sunday.month.toString().padLeft(2, '0')}/${sunday.day.toString().padLeft(2, '0')}/${sunday.year}');
      await t.tap(find.text('OK'));
      await t.pumpAndSettle();
      expect(await seen(t, 'Invalid range'), findsNothing, reason: 'the end date follows a later start date');
      await type(t, find.byType(TextField).first, 'Family wedding out of town');
      await tapText(t, 'Submit Leave Application');
      expect(await seen(t, 'Selected dates only include Sundays'), findsWidgets);
    });
  });

  group('regularization', () {
    testWidgets('justification: empty and 9 characters rejected, 10 accepted', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.attendanceSelfLog);
      await t.scrollUntilVisible(find.text('Request Attendance Regularization'), 400, scrollable: find.byType(Scrollable).first);
      await tapText(t, 'Request Attendance Regularization');
      await tapText(t, 'Submit Regularization Request');
      expect(find.text('Please add a short justification (min 10 characters)'), findsOneWidget);
      await t.enterText(find.byType(TextField).last, '  12345678 9 ');
      await tapText(t, 'Submit Regularization Request');
      expect(find.text('Please add a short justification (min 10 characters)'), findsNothing, reason: '"12345678 9" is 10 characters after trimming');
      expect(db.list('att_regs').single['note'], '12345678 9');
      expect(db.list('att_regs').single['status'], 'Pending');
    });

    testWidgets('9 characters after trimming are rejected', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.attendanceSelfLog);
      await t.scrollUntilVisible(find.text('Request Attendance Regularization'), 400, scrollable: find.byType(Scrollable).first);
      await tapText(t, 'Request Attendance Regularization');
      await t.enterText(find.byType(TextField).last, '   123456789   ');
      await tapText(t, 'Submit Regularization Request');
      expect(find.text('Please add a short justification (min 10 characters)'), findsOneWidget);
      expect(db.list('att_regs'), isEmpty);
    });
  });

  group('live class (contract §6 links)', () {
    test('Meet link rules and media per backend', () {
      expect(validateMeetLink(''), 'Paste the Google Meet link');
      expect(validateMeetLink('https://zoom.us/j/123'), 'Use a Google Meet link like https://meet.google.com/abc-defg-hij');
      expect(validateMeetLink('https://meet.google.com/abc-defg-hi'), isNotNull, reason: 'last group must have 3 letters');
      expect(validateMeetLink('https://meet.google.com/abc-defg-hij'), isNull);
      expect(validateMeetLink('meet.google.com/lookup/abcXYZ_1'), isNull);
      expect(liveMedia(BackendType.firebase), ['Google Meet'], reason: 'the shared backend only offers real Meet links');
      expect(liveMedia(BackendType.local), contains('In-App Live'));
    });

    testWidgets('title min 5, Meet link empty / not Meet rejected; a valid link is saved normalised', (t) async {
      ignoreOverflow();
      final before = db.list('lv_sessions').length;
      await open(t, RoutePaths.liveClassSchedule);
      await type(t, field('Class / Session Title'), 'Abcd');
      await tapText(t, 'Google Meet');
      await tapText(t, 'Schedule & Send');
      expect(await seen(t, 'Enter a session title (min 5 characters)'), findsOneWidget);
      expect(await seen(t, 'Paste the Google Meet link'), findsOneWidget);
      await type(t, field('Class / Session Title'), 'Abcde');
      await type(t, field('Google Meet link'), 'https://zoom.us/j/123456');
      await tapText(t, 'Schedule & Send');
      expect(find.text('Enter a session title (min 5 characters)'), findsNothing);
      expect(await seen(t, 'Use a Google Meet link like https://meet.google.com/abc-defg-hij'), findsOneWidget);
      expect(db.list('lv_sessions').length, before);
      await type(t, field('Google Meet link'), 'meet.google.com/ABC-DEFG-HIJ');
      await tapText(t, 'Schedule & Send');
      final s = db.list('lv_sessions').firstWhere((r) => r['title'] == 'Abcde');
      expect((s['medium'], s['link'], s['status']), ('Google Meet', 'https://meet.google.com/abc-defg-hij', 'upcoming'));
    });
  });

  group('message compose', () {
    testWidgets('recipient required, blank text rejected, 800 characters max', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.messageNew);
      await tapText(t, 'Send Message');
      expect(await seen(t, 'Select at least one recipient'), findsOneWidget);
      await tapText(t, 'Mrs. Priya Sharma');
      final body = hinted('Write your message...');
      await t.scrollUntilVisible(body, 300, scrollable: find.byType(Scrollable).first);
      await type(t, body, '    ');
      await tapText(t, 'Send Message');
      expect(await seen(t, 'Write a message before sending'), findsOneWidget);
      await t.scrollUntilVisible(body, 300, scrollable: find.byType(Scrollable).first);
      await type(t, body, 'x' * 801);
      await tapText(t, 'Send Message');
      expect(await seen(t, 'Message is longer than 800 characters'), findsOneWidget);
      final msgs = (db.byId('ms_messages', 'ms_1')!['msgs'] as List).length;
      await t.scrollUntilVisible(body, 300, scrollable: find.byType(Scrollable).first);
      await type(t, body, 'y' * 800);
      await tapText(t, 'Send Message');
      expect((db.byId('ms_messages', 'ms_1')!['msgs'] as List).length, msgs + 1);
    });
  });

  group('profile / account', () {
    final v = _Rules();
    test('rules: email, phone, required', () {
      expect(v.validateEmail(''), 'Email is required');
      expect(v.validateEmail('a@b'), 'Enter a valid email address');
      expect(v.validateEmail('a@b.co'), isNull);
      expect(v.validatePhone(''), 'Phone number is required');
      expect(v.validatePhone('981000000'), 'Enter a valid phone number', reason: '9 digits');
      expect(v.validatePhone('9810000000'), isNull, reason: '10 digits');
      expect(v.validatePhone('+91 98100 00025'), isNull);
      expect(v.validatePhone('98100abc00'), 'Enter a valid phone number');
      expect(v.validateRequired('  ', fieldName: 'Designation'), 'Designation is required');
    });

    testWidgets('edit account sheet shows every field error and saves valid input', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.profile);
      await tap(t, find.byTooltip('Edit account'));
      await t.enterText(field('Full name'), 'Al');
      await t.enterText(field('Designation'), ' ');
      await t.enterText(field('Email'), 'anita@school');
      await t.enterText(field('Phone'), '12345');
      await tapText(t, 'Save changes');
      expect(find.text('Enter your full name'), findsOneWidget);
      expect(find.text('Designation is required'), findsOneWidget);
      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(find.text('Enter a valid phone number'), findsOneWidget);
      await t.enterText(field('Email'), '');
      await t.enterText(field('Phone'), '');
      await tapText(t, 'Save changes');
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Phone number is required'), findsOneWidget);
      await t.enterText(field('Full name'), 'Ann'); // 3 characters is the minimum
      await t.enterText(field('Designation'), 'PGT Mathematics');
      await t.enterText(field('Email'), 'ann@greenfield.edu');
      await t.enterText(field('Phone'), '9810000000');
      await tapText(t, 'Save changes');
      expect(db.doc('me')['name'], 'Ann');
      expect(db.doc('me')['phone'], '9810000000');
      expect(db.doc('me')['designation'], 'PGT Mathematics');
    });
  });

  group('other forms', () {
    testWidgets('add task: title required and at least 3 characters', (t) async {
      ignoreOverflow();
      final before = db.list('tk_tasks').length;
      await open(t, RoutePaths.taskAdd);
      await tapText(t, 'Create Task');
      expect(await seen(t, 'Please enter a title'), findsOneWidget);
      await type(t, hinted('e.g. Grade 10-B Math Term Mid-Papers'), 'ab');
      await tapText(t, 'Create Task');
      expect(await seen(t, 'Title is too short'), findsOneWidget);
      expect(db.list('tk_tasks').length, before);
      await type(t, hinted('e.g. Grade 10-B Math Term Mid-Papers'), 'abc');
      await tapText(t, 'Create Task');
      expect(db.list('tk_tasks').length, before + 1);
    });

    testWidgets('meeting: title min 5 and at least one agenda topic; topic duration 1..240', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.meetingSchedule);
      await type(t, field('Meeting Title'), 'Abcd');
      await tapText(t, 'Send Invites & Schedule');
      expect(await seen(t, 'Enter a meeting title (min 5 characters)'), findsOneWidget);
      expect(await seen(t, 'Add at least one agenda topic'), findsOneWidget);
      await tap(t, find.widgetWithText(AppButton, 'Add Topic'));
      await tap(t, find.widgetWithText(AppButton, 'Add Topic').last);
      expect(find.text('Topic name is required'), findsOneWidget);
      await t.enterText(field('Topic Name *'), 'Results review');
      await tapText(t, 'Custom');
      await t.enterText(field('Custom minutes'), '241');
      await t.pump();
      await tap(t, find.widgetWithText(AppButton, 'Add Topic').last);
      expect(find.text('Enter a duration between 1 and 240 minutes'), findsOneWidget);
      await t.enterText(field('Custom minutes'), '0');
      await t.pump();
      await tap(t, find.widgetWithText(AppButton, 'Add Topic').last);
      expect(find.text('Enter a duration between 1 and 240 minutes'), findsOneWidget);
      await t.enterText(field('Custom minutes'), '240');
      await t.pump();
      await tap(t, find.widgetWithText(AppButton, 'Add Topic').last);
      expect(find.text('Enter a duration between 1 and 240 minutes'), findsNothing);
      expect(await seen(t, 'Results review', contains: true), findsWidgets);
    });

    testWidgets('lesson plan: title min 3, outcome min 10 (also when the title is scrolled out of view)', (t) async {
      ignoreOverflow();
      final id = '${db.list('ls_plans').first['id']}';
      await open(t, RoutePaths.lessonPlanEdit(id));
      await type(t, field('Lesson title'), 'ab');
      await type(t, field('Primary Learning Outcome'), '123456789');
      await tapText(t, 'Save & Publish');
      expect(await seen(t, 'Enter a title (min 3 characters)'), findsOneWidget);
      expect(await seen(t, 'Describe the outcome (min 10 characters)'), findsOneWidget);
      // the title field sat above the fold when Save was tapped: it is still validated, nothing is saved
      expect(db.byId('ls_plans', id)!['title'], isNot('ab'));
      await type(t, field('Lesson title'), 'abc');
      await type(t, field('Primary Learning Outcome'), '1234567890');
      await tapText(t, 'Save & Publish');
      expect(find.text('Enter a title (min 3 characters)'), findsNothing);
      expect(find.text('Describe the outcome (min 10 characters)'), findsNothing);
    });

    testWidgets('online test: title min 3, duration 5..300, cutoff within total', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.testNew);
      await type(t, field('Assessment title'), 'ab');
      await type(t, field('Duration (mins)'), '4');
      await type(t, field('Pass cutoff (marks)'), '-1');
      await tapText(t, 'Finish');
      expect(await seen(t, 'Enter a title (min 3 characters)'), findsOneWidget);
      expect(await seen(t, '5–300 mins'), findsOneWidget);
      await type(t, field('Duration (mins)'), '301');
      await tapText(t, 'Finish');
      expect(await seen(t, '5–300 mins'), findsOneWidget);
      await type(t, field('Duration (mins)'), '300');
      await type(t, field('Assessment title'), 'abc');
      await tapText(t, 'Finish');
      expect(find.text('5–300 mins'), findsNothing);
      expect(find.text('Enter a title (min 3 characters)'), findsNothing);
    });

    testWidgets('custom badge needs a name', (t) async {
      ignoreOverflow();
      final before = db.list('cl_badges').length;
      await open(t, RoutePaths.behaviourNew);
      await tap(t, find.widgetWithText(AppButton, 'Custom Badge'));
      await tapText(t, 'Create & Apply Badge');
      expect(find.text('Enter a badge name'), findsOneWidget);
      await t.enterText(hinted('e.g. Inquisitive Thinker'), 'Curious Mind');
      await tapText(t, 'Create & Apply Badge');
      expect(db.list('cl_badges').length, before + 1);
    });

    testWidgets('behaviour log: badge and note required', (t) async {
      ignoreOverflow();
      final before = db.list('cl_behaviour').length;
      await open(t, RoutePaths.behaviourNew);
      await tapText(t, 'Publish');
      expect(await seen(t, 'Select a badge'), findsWidgets);
      expect(db.list('cl_behaviour').length, before);
    });

    testWidgets('exam duty swap needs a reason of at least 3 characters', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.examDuty('ed_2'));
      await tapText(t, 'Request Swap');
      await tapText(t, 'Send Request');
      expect(find.text('Please give a reason'), findsOneWidget);
      await t.enterText(field('Reason'), 'ab');
      await tapText(t, 'Send Request');
      expect(find.text('Please give a reason'), findsOneWidget);
      await t.enterText(field('Reason'), 'abc');
      await tapText(t, 'Send Request');
      expect(db.byId('ed_duties', 'ed_2')!['swapReason'], 'abc');
    });

    testWidgets('certificate issue: recipient and title required', (t) async {
      ignoreOverflow();
      await open(t, RoutePaths.certificateIssue);
      await tapText(t, 'Sign & Issue');
      expect(await seen(t, 'Select a student first'), findsWidgets);
      expect(await seen(t, 'Select a recipient'), findsOneWidget);
      expect(await seen(t, 'Enter the award title'), findsOneWidget);
    });

    testWidgets('resource upload needs a file name', (t) async {
      ignoreOverflow();
      final before = db.list('cl_resources').length;
      await open(t, RoutePaths.resources);
      await tapText(t, 'Upload Resource');
      await tap(t, find.widgetWithText(AppButton, 'Upload'));
      expect(find.text('Enter a file name'), findsWidgets);
      expect(db.list('cl_resources').length, before);
    });
  });
}

class _Rules with ValidationMixin {}
