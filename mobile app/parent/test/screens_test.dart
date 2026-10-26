import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/homework/models/homework_models.dart';
import 'package:parent_app/modules/homework/repositories/homework_repository_interface.dart';
import 'package:parent_app/modules/timetable/models/timetable_models.dart';
import 'package:parent_app/modules/timetable/repositories/timetable_repository_interface.dart';
import 'helpers/pump_app.dart';

Future<void> tab(WidgetTester t, String label) async {
  await t.tap(
    find.descendant(of: find.byType(AppDock), matching: find.text(label)),
  );
  await t.pumpAndSettle();
}

Future<void> back(WidgetTester t) async {
  await t.tap(find.byTooltip('Back'));
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
  testWidgets('Attendance tab: percentage, calendar and absence list', (
    t,
  ) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    await tab(t, 'Attendance');
    expect(find.text('TERM ATTENDANCE'), findsOneWidget);
    expect(find.byKey(const Key('overall-percent')), findsOneWidget);
    expect(find.text('Calendar'), findsOneWidget);
    final title = (t.widget(find.byKey(const Key('month-title'))) as Text).data;
    await t.tap(find.byTooltip('Previous month'));
    await t.pumpAndSettle();
    expect(
      (t.widget(find.byKey(const Key('month-title'))) as Text).data,
      isNot(title),
    );
    await t.scrollUntilVisible(
      find.text('Absences'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Absences'), findsOneWidget);
  });

  testWidgets(
    'Learn tab: homework -> detail, marks -> report card, timetable',
    (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t);
      await tab(t, 'Learn');
      expect(find.text('Quadratic equations - Exercise 4.2'), findsOneWidget);

      await t.tap(find.text('Overdue').first); // the filter chip
      await t.pumpAndSettle();
      expect(find.text('Map work - rivers of India'), findsOneWidget);
      expect(find.text('Quadratic equations - Exercise 4.2'), findsNothing);
      await t.tap(find.text('Map work - rivers of India'));
      await t.pumpAndSettle();
      expect(find.text('Instructions'), findsOneWidget);
      await back(t);

      await t.tap(find.text('Marks'));
      await t.pumpAndSettle();
      expect(find.text('Results awaited'), findsNothing);
      expect(
        find.text('Upcoming'),
        findsOneWidget,
      ); // Term 1 final: not published
      await t.tap(find.text('Mid-Term Exam'));
      await t.pumpAndSettle();
      expect(find.text('Subject-wise marks'), findsOneWidget);
      expect(find.byKey(const Key('exam-total')), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);
      await back(t);

      await t.tap(find.text('Timetable'));
      await t.pumpAndSettle();
      expect(find.text('Mon'), findsOneWidget);
      await t.tap(find.text('Wed'));
      await t.pumpAndSettle();
      expect(find.textContaining('08:30 AM'), findsOneWidget);
    },
  );

  testWidgets('Inbox tab: acknowledge a notice, chat with a teacher', (
    t,
  ) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    await tab(t, 'Inbox');
    expect(find.text('Parent-teacher meeting this Saturday'), findsOneWidget);
    expect(find.text('Acknowledge'), findsNWidgets(2));
    await t.tap(find.text('Acknowledge').first);
    await t.pumpAndSettle();
    expect(find.text('Acknowledge'), findsOneWidget);
    expect(find.text('Acknowledged'), findsOneWidget);

    await t.tap(find.text('Messages'));
    await t.pumpAndSettle();
    await t.tap(find.text('Mrs. Anita Sharma'));
    await t.pumpAndSettle();
    expect(find.text('Thank you, I will keep an eye on it.'), findsWidgets);
    await t.enterText(
      find.byKey(const Key('chat-input')),
      'See you on Saturday',
    );
    await t.tap(find.byKey(const Key('chat-send')));
    await t.pumpAndSettle();
    expect(find.text('See you on Saturday'), findsOneWidget);
  });

  testWidgets(
    'More: live classes, leave application, fees, profile and sign out',
    (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t);
      await tab(t, 'More');

      await t.tap(find.text('Live classes'));
      await t.pumpAndSettle();
      expect(
        find.widgetWithText(FilledButton, 'Join on Google Meet'),
        findsOneWidget,
      ); // the class that starts in 5 minutes
      await back(t);

      await t.tap(find.text('Leave'));
      await t.pumpAndSettle();
      expect(find.text('Dental appointment'), findsOneWidget);
      await t.tap(find.text('Apply for leave'));
      await t.pumpAndSettle();
      await t.tap(find.text('Send application'));
      await t.pumpAndSettle();
      expect(
        find.byKey(const Key('leave-error')),
        findsOneWidget,
      ); // reason required
      await t.enterText(find.byType(TextFormField), 'Visiting grandparents');
      await t.tap(find.text('Send application'));
      await t.pumpAndSettle();
      expect(
        find.text('Visiting grandparents'),
        findsOneWidget,
      ); // back on the history, new item on top
      await back(t);

      await t.tap(find.text('Fees'));
      await t.pumpAndSettle();
      expect(find.text('BALANCE DUE'), findsOneWidget);
      expect(
        find.textContaining('Online payment is not available'),
        findsOneWidget,
      );
      await back(t);

      await t.tap(find.text('Profile and settings'));
      await t.pumpAndSettle();
      expect(find.text('Aarav Sharma'), findsOneWidget);
      expect(find.text('Ananya Sharma'), findsOneWidget);
      await t.tap(find.text('Ananya Sharma'));
      await t.pumpAndSettle();
      expect(find.text('Selected'), findsOneWidget);
      await t.scrollUntilVisible(
        find.widgetWithText(FilledButton, 'Sign out'),
        300,
      );
      await t.tap(find.widgetWithText(FilledButton, 'Sign out'));
      await t.pumpAndSettle();
      await t.tap(find.text('Sign out').last);
      await t.pumpAndSettle();
      expect(find.text('Welcome, parent'), findsOneWidget);
    },
  );

  group('loading / empty / error states', () {
    testWidgets('empty list shows the empty state', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_EmptyHomework());
      await pumpApp(t);
      await tab(t, 'Learn');
      expect(find.text('No homework'), findsOneWidget);
    });

    testWidgets('failure without cache shows the error with Retry', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_FailingHomework());
      await pumpApp(t);
      await tab(t, 'Learn');
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
      await pumpApp(t);
      await tab(t, 'Learn');
      await t.tap(find.text('Timetable'));
      await t.pump();
      await t.pump();
      expect(find.byType(AppLoading), findsOneWidget);
    });
  });

  test('demo data matches the demo family', () {
    expect(DemoData.guardian.name, 'Mr. Rajesh Sharma');
    expect(DemoData.aarav.className, '10-B');
    expect(DemoData.ananya.className, '8-C');
  });
}
