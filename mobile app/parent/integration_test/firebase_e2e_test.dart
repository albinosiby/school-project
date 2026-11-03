// Live UI run of the parent app on a phone against the LOCAL Firebase emulators, right after the driver app's run
// (mobile app/driver/integration_test/run_on_device.sh): the parent must see what the bus crew did.
//
//   flutter test integration_test/firebase_e2e_test.dart -d <device> --dart-define=BACKEND=firebase --dart-define=EMULATOR=true \
//     --dart-define=EMULATOR_USB=true --dart-define=E2E_EMAIL=parent@e2e.test --dart-define=E2E_PASSWORD=<.accounts.json>
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:parent_app/design_system/design_system.dart' show AppTextField;
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/main.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';

const _email = String.fromEnvironment('E2E_EMAIL');
const _password = String.fromEnvironment('E2E_PASSWORD');
const _school = String.fromEnvironment('E2E_SCHOOL', defaultValue: 'e2e_school');

bool found(Finder f) {
  try {
    return f.evaluate().isNotEmpty;
  } on RangeError {
    return false;
  } on StateError {
    return false;
  }
}

Future<void> until(WidgetTester t, Finder f, {int seconds = 40}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await t.pump(const Duration(milliseconds: 100));
    if (found(f)) return;
  }
  String what;
  try {
    what = '$f';
  } catch (_) {
    what = f.runtimeType.toString();
  }
  throw TestFailure('not found within ${seconds}s: $what');
}

/// scrolls the visible vertical list (down, then back up) until [f] is built
Future<void> reveal(WidgetTester t, Finder f) async {
  for (final dy in [-300.0, 300.0]) {
    for (var i = 0; i < 30 && !found(f); i++) {
      // the page's list is the largest vertical scrollable by area (a multi-line text field and the side rail have small ones)
      double area(Element e) => (e.size?.width ?? 0) * (e.size?.height ?? 0);
      final lists = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).evaluate().toList()
        ..sort((a, b) => area(b).compareTo(area(a)));
      if (lists.isNotEmpty) await t.dragFrom(t.getCenter(find.byElementPredicate((e) => e == lists.first)), Offset(0, dy));
      await t.pump(const Duration(milliseconds: 250));
    }
  }
  await until(t, f, seconds: 10);
  await t.ensureVisible(f.first);
  await t.pump(const Duration(milliseconds: 300));
}

Future<void> tapIn(WidgetTester t, Finder f) async {
  await reveal(t, f);
  await t.tap(f.first, warnIfMissed: false);
  await t.pump(const Duration(milliseconds: 600));
}

Future<void> type(WidgetTester t, Finder f, String text) async {
  await reveal(t, f);
  await t.enterText(f.first, text);
  await t.pump(const Duration(milliseconds: 300));
}

Finder field(String label) => find.descendant(of: find.widgetWithText(AppTextField, label), matching: find.byType(TextFormField));

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('parent: sign in, child, bus card, track live, transport alerts, student transport, apply leave', (t) async {
    expect(_email, isNotEmpty, reason: 'pass --dart-define=E2E_EMAIL / E2E_PASSWORD');
    final app = await bootstrap();
    if (getIt<AuthBloc>().state.isAuthenticated) {
      getIt<AuthBloc>().add(const LogoutRequested());
      await getIt<AuthBloc>().stream.firstWhere((s) => !s.isAuthenticated);
    }
    await t.pumpWidget(app);

    // sign in with the login the admin web created and linked to Aarav + Meera
    await tapIn(t, find.text('Sign In with Mobile / School ID'));
    await tapIn(t, find.text('School ID / Email').first);
    await type(t, field('School ID / Email'), _email);
    await type(t, field('Password'), _password);
    await t.testTextInput.receiveAction(TextInputAction.done);
    await tapIn(t, find.byKey(const Key('login-submit')));
    await until(t, find.text('Select Student Profile'));
    await tapIn(t, find.byKey(const ValueKey('select-child-stu_101')));
    await tapIn(t, find.byKey(const Key('select-child-continue')));

    // first sign-in: the consent sheet (contract 13.3); the admin web shows the family as "Given" from consents/{uid}
    await until(t, find.byKey(const Key('consent-submit')));
    final photos = find.descendant(of: find.byKey(const Key('consent-photos')), matching: find.byType(Switch));
    await t.ensureVisible(photos);
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(photos);
    await t.pump(const Duration(milliseconds: 300));
    await t.ensureVisible(find.byKey(const Key('consent-submit')));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.byKey(const Key('consent-submit')));
    final me = FirebaseAuth.instance.currentUser!.uid;
    Map<String, dynamic>? consent;
    for (var i = 0; i < 60 && consent == null; i++) {
      consent = (await FirebaseFirestore.instance.doc('schools/$_school/consents/$me').get()).data();
      if (consent == null) await t.pump(const Duration(milliseconds: 500));
    }
    expect(consent?['items'], {'dataProcessing': true, 'photos': true, 'notifications': true});
    expect((consent?['studentIds'] as List).toSet(), {'stu_101', 'stu_201'});
    await reveal(t, find.text('Track Live'));

    // Home: the bus card from par_transport (schedule-based, no GPS)
    await reveal(t, find.text('Track Live'));
    await reveal(t, find.textContaining('BUS #14'));
    await reveal(t, find.text('SCHEDULE'));
    await tapIn(t, find.text('Track Live'));
    await reveal(t, find.textContaining('Ramesh Kumar'));
    await reveal(t, find.textContaining('Suresh Yadav'));

    // the crew's marks reached the parent as in-app notifications
    app.router.go('/notifications');
    await reveal(t, find.textContaining('Aarav Sharma got off at school'));
    await reveal(t, find.textContaining('Aarav Sharma boarded Bus 14'));

    // Student profile > Transport
    app.router.go('/more/student');
    await reveal(t, find.textContaining('14'));
    await reveal(t, find.textContaining('Ramesh Kumar'));

    // apply for a leave; the class teacher's app reads it from student_leaves
    app.router.go('/more/leave/apply');
    await reveal(t, find.byKey(const Key('leave-reason')));
    await t.enterText(find.byKey(const Key('leave-reason')), 'Family wedding out of town');
    await t.testTextInput.receiveAction(TextInputAction.done);
    FocusManager.instance.primaryFocus?.unfocus();
    await t.pump(const Duration(milliseconds: 500));
    for (var i = 0; i < 12 && !found(find.text('Submit Leave Application')); i++) {
      await t.drag(find.byKey(const Key('leave-reason')).first, const Offset(0, -400), warnIfMissed: false);
      await t.pump(const Duration(milliseconds: 300));
    }
    // ignore: avoid_print
    print('E2E TEXTS: ${t.widgetList<Text>(find.byType(Text)).map((w) => w.data).whereType<String>().take(60).join(' | ')}');
    await tapIn(t, find.text('Submit Leave Application'));
    final uid = FirebaseAuth.instance.currentUser!.uid;
    Map<String, dynamic>? leave;
    for (var i = 0; i < 60 && leave == null; i++) {
      final q = await FirebaseFirestore.instance.collection('schools/$_school/student_leaves').where('studentId', isEqualTo: 'stu_101').get();
      leave = q.docs.where((d) => d.data()['parentUid'] == uid).firstOrNull?.data();
      if (leave == null) await t.pump(const Duration(milliseconds: 500));
    }
    expect(leave, isNotNull, reason: 'student_leaves doc from the parent app');
    expect(leave!['status'], 'Pending');
    expect(leave['classId'], 'cls_10B');
  });
}
