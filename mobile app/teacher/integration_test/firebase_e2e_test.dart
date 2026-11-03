// Live UI run of the teacher app on a phone against the LOCAL Firebase emulators, after the driver and parent runs
// (the parent applied for a leave for Aarav): the class teacher approves it and marks Aarav absent.
//
//   integration_test/run_after_parent.sh <device-id>
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:teacher_app/config/routes/routes_config.dart' show router;
import 'package:teacher_app/design_system/design_system.dart' show AppTextField;
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/main.dart';
import 'package:teacher_app/modules/auth/bloc/auth_bloc.dart';
import 'package:teacher_app/modules/auth/bloc/auth_events.dart';
import 'package:teacher_app/utils/services/local_storage_service.dart';

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

/// a widget whose Semantics label is [label] (attendance codes: "Aarav Sharma Absent")
Finder semantics(String label) => find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label);

String _today() {
  final d = DateTime.now();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('teacher: sign in, approve the parent leave, mark Aarav absent', (t) async {
    expect(_email, isNotEmpty, reason: 'pass --dart-define=E2E_EMAIL / E2E_PASSWORD');
    final app = await bootstrap();
    await getIt<LocalStorageService>().setOnboardingComplete(); // the first-run walkthrough is covered by widget tests
    if (getIt<AuthBloc>().state.signedIn) {
      getIt<AuthBloc>().add(const AuthSignOutRequested());
      await getIt<AuthBloc>().stream.firstWhere((s) => !s.signedIn);
    }
    await t.pumpWidget(app);

    await type(t, field('School email'), _email);
    await type(t, field('Password'), _password);
    await t.testTextInput.receiveAction(TextInputAction.done);
    await tapIn(t, find.text('Sign in'));
    // signed in: the login form goes away (the router guard opens Home)
    for (var i = 0; i < 600 && !getIt<AuthBloc>().state.signedIn; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
    expect(getIt<AuthBloc>().state.signedIn, isTrue, reason: 'teacher signed in');
    await t.pump(const Duration(seconds: 2));

    // the parent's leave request (student_leaves, written by the parent app) reaches the class teacher
    router.go('/leave-management/students');
    await reveal(t, find.textContaining('Family wedding out of town'));
    await tapIn(t, find.text('Approve'));
    await tapIn(t, find.text('Approve').last); // confirm dialog
    Map<String, dynamic>? leave;
    for (var i = 0; i < 60; i++) {
      final q = await FirebaseFirestore.instance.collection('schools/$_school/student_leaves').where('studentId', isEqualTo: 'stu_101').get();
      leave = q.docs.where((d) => d.data()['reason'] == 'Family wedding out of town').firstOrNull?.data();
      if (leave?['status'] == 'Approved') break;
      await t.pump(const Duration(milliseconds: 500));
    }
    expect(leave?['status'], 'Approved');

    // attendance: Aarav absent, submitted
    router.go('/attendance/mark');
    await reveal(t, semantics('Aarav Sharma Absent'));
    await tapIn(t, semantics('Aarav Sharma Absent'));
    await tapIn(t, find.text('Submit Attendance'));
    final today = _today();
    Map<String, dynamic>? rec;
    for (var i = 0; i < 60; i++) {
      final q = await FirebaseFirestore.instance.collection('schools/$_school/ops_attendance').where('teacherId', isEqualTo: 'stf_025').get();
      rec = q.docs.map((d) => d.data()).where((d) => d['date'] == today && d['classId'] == 'cls_10B' && (d['marks'] as Map?)?['stu_101'] == 'A').firstOrNull;
      if (rec != null) break;
      await t.pump(const Duration(milliseconds: 500));
    }
    expect(rec, isNotNull, reason: 'ops_attendance with stu_101 absent');
    expect(rec!['submitted'], true);
  });
}
