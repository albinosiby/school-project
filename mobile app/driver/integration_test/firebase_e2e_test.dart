// Live UI run on a phone against the LOCAL Firebase emulators (seeded by website/tools/e2e/seed.mjs).
//
//   adb reverse tcp:8080 tcp:8080 && adb reverse tcp:9099 tcp:9099
//   flutter test integration_test/firebase_e2e_test.dart -d <device> \
//     --dart-define=BACKEND=firebase --dart-define=EMULATOR=true --dart-define=EMULATOR_USB=true \
//     --dart-define=E2E_EMAIL=driver@e2e.test --dart-define=E2E_PASSWORD=<from tools/e2e/.accounts.json>
//
// Drives the real screens by widget (works in portrait and landscape) and reads Firestore back as the signed-in driver to
// confirm every write landed in the shape the admin web and the parent projection expect.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:driver_app/design_system/design_system.dart' show AppTextField;
import 'package:driver_app/main.dart';
import 'package:driver_app/modules/auth/bloc/auth_bloc.dart';
import 'package:driver_app/di/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

const _email = String.fromEnvironment('E2E_EMAIL');
const _password = String.fromEnvironment('E2E_PASSWORD');
const _school = String.fromEnvironment('E2E_SCHOOL', defaultValue: 'e2e_school');

/// pumps until [f] finds something (network + functions are real here, so fixed pumps are not enough)
Future<void> until(WidgetTester t, Finder f, {int seconds = 40}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await t.pump(const Duration(milliseconds: 100));
    if (found(f)) return;
  }
  String what;
  try {
    what = '$f';
  } catch (_) {
    what = f.runtimeType.toString(); // describing an indexed finder evaluates it
  }
  throw TestFailure('not found within ${seconds}s: $what');
}

/// whether [f] matches anything (an indexed finder like `.at(1)` throws instead of returning empty)
bool found(Finder f) {
  try {
    return f.evaluate().isNotEmpty;
  } on RangeError {
    return false;
  } on StateError {
    return false; // `.last` / `.first` of nothing
  }
}

/// scrolls the visible vertical list (down, then back up) until [f] is built and on screen
Future<void> reveal(WidgetTester t, Finder f) async {
  for (final dy in [-300.0, 300.0]) {
    for (var i = 0; i < 30 && !found(f); i++) {
      // the page's list is the tallest vertical scrollable (a multi-line text field has its own small one)
      final lists = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).evaluate().toList()
        ..sort((a, b) => (b.size?.height ?? 0).compareTo(a.size?.height ?? 0));
      if (lists.isNotEmpty) await t.dragFrom(t.getCenter(find.byElementPredicate((e) => e == lists.first)), Offset(0, dy));
      await t.pump(const Duration(milliseconds: 250));
    }
  }
  await until(t, f, seconds: 10);
  await t.ensureVisible(f.first);
  await t.pump(const Duration(milliseconds: 300));
}

Future<void> type(WidgetTester t, Finder f, String text) async {
  await reveal(t, f);
  await t.enterText(f, text);
  await t.pump(const Duration(milliseconds: 300));
}

/// scrolls until [f] is built, then taps it
Future<void> tapIn(WidgetTester t, Finder f) async {
  await reveal(t, f);
  await t.pump(const Duration(milliseconds: 300));
  await t.tap(f.first, warnIfMissed: false);
  await t.pump(const Duration(milliseconds: 600));
}

Future<Map<String, dynamic>?> read(String path) async => (await FirebaseFirestore.instance.doc('schools/$_school/$path').get()).data();

Future<T> eventually<T>(Future<T?> Function() fn, String what, {int seconds = 30}) async {
  for (var i = 0; i < seconds * 2; i++) {
    final v = await fn();
    if (v != null && v != false) return v;
    await Future<void>.delayed(const Duration(milliseconds: 500));
  }
  throw TestFailure('timed out: $what');
}

String _today() {
  final d = DateTime.now();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('driver: sign in, checklist, start trip, mark pupils, end trip, check in, leave, profile', (t) async {
    expect(_email, isNotEmpty, reason: 'pass --dart-define=E2E_EMAIL / E2E_PASSWORD');
    final app = await bootstrap();
    if (getIt<AuthBloc>().state.isAuthenticated) {
      getIt<AuthBloc>().add(const LogoutRequested());
      await getIt<AuthBloc>().stream.firstWhere((s) => !s.isAuthenticated);
    }
    await t.pumpWidget(app);
    final today = _today();
    final pickup = '${today}_bus_01_pickup';

    // sign in with the login the admin web created (seed: users role driver + crewId)
    await tapIn(t, find.text('Get Started'));
    await until(t, find.text('Driver / Bus Staff Sign In'));
    await type(t, find.byType(TextFormField).at(0), _email);
    await type(t, find.byType(TextFormField).at(1), _password);
    await t.testTextInput.receiveAction(TextInputAction.done);
    await tapIn(t, find.text('Sign In'));
    await until(t, find.textContaining('Welcome, Ramesh'));
    expect(find.text('Bus 14'), findsWidgets);

    // the trip docs the admin web lists under Transport > Trips
    final trip = await eventually(() => read('tr_trips/$pickup'), 'today pickup trip');
    expect(trip['status'], 'scheduled');
    expect(trip['total'], 5);

    // checklist gate, then start
    await tapIn(t, find.text('Start pre-trip checklist'));
    await until(t, find.textContaining('Complete pre-trip checklist'));
    await tapIn(t, find.textContaining('Complete pre-trip checklist'));
    await until(t, find.text('Pre-trip checklist'));
    for (var i = 0; i < 6; i++) {
      final tile = find.byType(CheckboxListTile).at(i);
      await reveal(t, tile);
      if (t.widget<CheckboxListTile>(tile).value != true) await tapIn(t, tile);
    }
    await reveal(t, find.textContaining('All 6 checks passed'));
    await tapIn(t, find.text('Save & mark passed'));
    await until(t, find.text('Start pickup trip'));
    await tapIn(t, find.text('Start pickup trip'));
    await tapIn(t, find.text('Start trip'));
    await until(t, find.text('End trip'));
    expect((await read('tr_trips/$pickup'))?['status'], 'active');

    // mark pupils from the trip's student list
    await tapIn(t, find.byKey(const ValueKey('mark-Boarded-Aarav Sharma')));
    await tapIn(t, find.byKey(const ValueKey('mark-Absent-Meera Sharma')));
    final att = await eventually(() async {
      final a = await read('tr_attendance/$pickup');
      final m = a?['marks'] as Map?;
      return m != null && m['stu_101']?['status'] == 'boarded' && m['stu_201']?['status'] == 'absent' ? a : null;
    }, 'marks in tr_attendance');
    expect(att['marks']['stu_101']['byName'], 'Ramesh Kumar');
    expect((await read('tr_trips/$pickup'))?['boarded'], 1);

    // end the pickup: boarded pupils arrive at school
    await tapIn(t, find.text('End trip'));
    await until(t, find.textContaining('End morning pickup'));
    await tapIn(t, find.text('End trip').last);
    await eventually(() async => (await read('tr_trips/$pickup'))?['status'] == 'completed', 'trip completed');
    expect(((await read('tr_attendance/$pickup'))?['marks'] as Map)['stu_101']['status'], 'dropped');

    // back to Home: check in
    await t.pageBack();
    await reveal(t, find.textContaining('Welcome, Ramesh'));
    await tapIn(t, find.text('Check in'));
    final day = await eventually(() => read('tr_crew_attendance/${today}_crw_001'), 'check-in day');
    expect(day['source'], 'app');

    // apply for leave from the quick actions
    await tapIn(t, find.text('Apply leave'));
    await until(t, find.text('Apply for leave'));
    await tapIn(t, find.text('Sick'));
    await type(t, find.byType(TextFormField).last, 'Fever since last night');
    await tapIn(t, find.text('Submit request'));
    final leaves = await eventually(() async {
      final q = await FirebaseFirestore.instance.collection('schools/$_school/tr_crew_leaves').where('crewId', isEqualTo: 'crw_001').get();
      return q.docs.isEmpty ? null : q.docs.first.data();
    }, 'leave request');
    expect(leaves['status'], 'Pending');
    expect(leaves['type'], 'Sick');

    // edit own emergency contact on the Profile tab
    await tapIn(t, find.text('Profile').last);
    await tapIn(t, find.text('Emergency contact'));
    await until(t, find.text('Edit profile'));
    // by label, not index: rows of a lazy list come and go while scrolling
    await type(t, find.descendant(of: find.widgetWithText(AppTextField, 'Emergency contact name'), matching: find.byType(TextFormField)).first, 'Sita Kumar (wife)');
    await tapIn(t, find.text('Save changes'));
    await eventually(() async => (await read('tr_crew/crw_001'))?['emergencyName'] == 'Sita Kumar (wife)', 'profile saved');
  });
}
