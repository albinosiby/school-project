import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/academics/screens/academics_screen.dart';
import 'package:parent_app/modules/auth/screens/welcome_screen.dart';
import 'package:parent_app/modules/behaviour/screens/behaviour_screen.dart';
import 'package:parent_app/modules/fees/screens/fees_screen.dart';
import 'package:parent_app/modules/home/screens/home_screen.dart';
import 'package:parent_app/modules/homework/models/homework_models.dart';
import 'package:parent_app/modules/homework/repositories/homework_repository_interface.dart';
import 'package:parent_app/modules/leave/screens/leave_apply_screen.dart';
import 'package:parent_app/modules/leave/screens/leave_screen.dart';
import 'package:parent_app/modules/live_classes/screens/live_classes_screen.dart';
import 'package:parent_app/modules/messages/screens/messages_screen.dart';
import 'package:parent_app/modules/more/screens/more_screen.dart';
import 'package:parent_app/modules/notifications/screens/notifications_screen.dart';
import 'package:parent_app/modules/profile/screens/profile_screen.dart';
import 'package:parent_app/modules/ptm/screens/ptm_screen.dart';
import 'package:parent_app/modules/settings/screens/privacy_policy_screen.dart';
import 'package:parent_app/modules/settings/screens/settings_screen.dart';
import 'package:parent_app/modules/student/screens/certificates_screen.dart';
import 'package:parent_app/modules/student/screens/student_profile_screen.dart';
import 'package:parent_app/modules/teachers/screens/teachers_screen.dart';
import 'package:parent_app/modules/timetable/models/timetable_models.dart';
import 'package:parent_app/modules/timetable/repositories/timetable_repository_interface.dart';
import 'package:parent_app/modules/transport/screens/track_live_screen.dart';
import 'helpers/pump_app.dart';

Future<void> tab(WidgetTester t, String label) async {
  await t.tap(
    find.descendant(of: find.byType(AppDock), matching: find.text(label)),
  );
  await t.pumpAndSettle();
}

/// Navigates like a deep link and lets the screen load.
Future<void> go(WidgetTester t, String location) async {
  GoRouter.of(t.element(find.byType(Scaffold).first)).go(location);
  await t.pumpAndSettle();
}

class _EmptyHomework implements IHomeworkRepository {
  @override
  Stream<List<Homework>> watchHomework(String childId) =>
      Stream.value(const []);
}

class _FailingHomework implements IHomeworkRepository {
  @override
  Stream<List<Homework>> watchHomework(String childId) =>
      Stream.error(Exception('offline'));
}

class _SlowTimetable implements ITimetableRepository {
  @override
  Stream<TimetableWeek> watchWeek(String childId) => const Stream.empty();
}

void main() {
  testWidgets('dock walks every tab', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    expect(find.byType(HomeScreen), findsOneWidget);
    for (final (label, screen) in [
      ('Academics', AcademicsScreen),
      ('Fees', FeesScreen),
      ('Messages', MessagesScreen),
      ('More', MoreScreen),
      ('Home', HomeScreen),
    ]) {
      await tab(t, label);
      expect(find.byType(screen), findsOneWidget, reason: label);
      expect(t.takeException(), isNull, reason: label);
    }
  });

  testWidgets('every Academics section opens', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    for (final s in ['attendance', 'homework', 'marks', 'timetable']) {
      await go(t, RoutePaths.academicsSection(s));
      expect(find.byType(AcademicsScreen), findsOneWidget, reason: s);
      expect(t.takeException(), isNull, reason: s);
    }
  });

  testWidgets('every More hub entry opens its screen', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t, location: RoutePaths.more);
    for (final (label, screen) in [
      ('Student Profile', StudentProfileScreen),
      ('Certificates', CertificatesScreen),
      ('Meetings', PtmScreen),
      ('Teachers', TeachersScreen),
      ('Behaviour', BehaviourScreen),
      ('Track Live', TrackLiveScreen),
      ('Apply Leave', LeaveApplyScreen),
      ('Leave History', LeaveScreen),
      ('Live Classes', LiveClassesScreen),
      ('Notifications', NotificationsScreen),
      ('My Profile', ProfileScreen),
      ('Settings', SettingsScreen),
      ('Privacy Policy', PrivacyPolicyScreen),
    ]) {
      final entry = find.descendant(
        of: find.byType(MoreScreen),
        matching: find.text(label),
      );
      await t.scrollUntilVisible(
        entry,
        200,
        scrollable: find
            .descendant(
              of: find.byType(MoreScreen),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await t.tap(entry);
      await t.pumpAndSettle();
      expect(find.byType(screen), findsOneWidget, reason: label);
      expect(t.takeException(), isNull, reason: label);
      await go(t, RoutePaths.more);
    }
  });

  testWidgets('every deep link renders without errors', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    for (final path in [
      RoutePaths.trackLive,
      RoutePaths.behaviour,
      RoutePaths.leave,
      RoutePaths.leaveApply,
      RoutePaths.liveClasses,
      RoutePaths.newMessage,
      RoutePaths.profile,
      RoutePaths.editProfile,
      RoutePaths.settings,
      RoutePaths.privacyPolicy,
      RoutePaths.notifications,
      RoutePaths.studentProfile,
      RoutePaths.certificates,
      RoutePaths.ptm,
      RoutePaths.teachers,
      RoutePaths.selectChild,
    ]) {
      await go(t, path);
      expect(t.takeException(), isNull, reason: path);
      expect(find.byType(Scaffold), findsWidgets, reason: path);
    }
  });

  testWidgets('signed-out users start on Welcome', (t) async {
    await setUpTestApp();
    await pumpApp(t);
    expect(find.byType(WelcomeScreen), findsOneWidget);
  });

  group('loading / empty / error states', () {
    testWidgets('empty list shows the empty state', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_EmptyHomework());
      await pumpApp(t, location: RoutePaths.academicsSection('homework'));
      expect(find.text('No homework'), findsOneWidget);
    });

    testWidgets('failure without cache shows the error with Retry', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_FailingHomework());
      await pumpApp(t, location: RoutePaths.academicsSection('homework'));
      expect(
        find.text('Something went wrong. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('loading placeholder is shown while data is on its way', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<ITimetableRepository>();
      getIt.registerSingleton<ITimetableRepository>(_SlowTimetable());
      await pumpApp(t, location: RoutePaths.academicsSection('timetable'));
      expect(find.byType(AppLoading), findsWidgets);
    });
  });

  test('demo data matches the demo family', () {
    expect(DemoData.guardian.name, 'Mr. Rajesh Sharma');
    expect(DemoData.aarav.className, '10-B');
    expect(DemoData.ananya.className, '8-C');
  });
}
