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

/// Every visible text on screen (for "no placeholder leaked" checks).
Iterable<String> texts(WidgetTester t) => t
    .widgetList<Text>(find.byType(Text))
    .map((w) => w.data ?? w.textSpan?.toPlainText() ?? '');

void expectNoPlaceholders(WidgetTester t) {
  final bad = texts(t).where((s) => RegExp(r'\b(null|NaN|undefined|Invalid Date|Instance of)\b').hasMatch(s));
  expect(bad, isEmpty, reason: bad.join('\n'));
}

void main() {
  testWidgets('end-to-end walk: every tab and the Academics sections open without errors', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    expect(t.takeException(), isNull);
    expectNoPlaceholders(t);

    await tab(t, 'Academics');
    for (final section in ['Attendance', 'Homework', 'Marks', 'Timetable']) {
      await t.tap(find.text(section).first);
      await t.pumpAndSettle();
      expect(t.takeException(), isNull, reason: section);
      expectNoPlaceholders(t);
    }

    for (final name in ['Fees', 'Messages', 'More', 'Home']) {
      await tab(t, name);
      expect(t.takeException(), isNull, reason: name);
      expectNoPlaceholders(t);
    }
  });

  testWidgets('Academics: homework opens its detail and comes back', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t);
    await tab(t, 'Academics');
    await t.tap(find.text('Homework').first);
    await t.pumpAndSettle();
    // the first demo assignment that is on screen (the list is lazy and filtered by status)
    final shown = DemoData.homework(DemoData.aarav.id).map((h) => h.title).firstWhere((title) => find.text(title).evaluate().isNotEmpty);
    await t.tap(find.text(shown).first);
    await t.pumpAndSettle();
    expect(find.text(shown), findsWidgets);
    expect(find.byTooltip('Back'), findsWidgets);
    await back(t);
    expect(find.text('Homework'), findsWidgets);
  });

  group('loading / empty / error states', () {
    testWidgets('empty list shows the empty state', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_EmptyHomework());
      await pumpApp(t);
      await tab(t, 'Academics');
      await t.tap(find.text('Homework').first);
      await t.pumpAndSettle();
      expect(find.text('No homework'), findsOneWidget);
    });

    testWidgets('failure without cache shows the error with Retry', (t) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<IHomeworkRepository>();
      getIt.registerSingleton<IHomeworkRepository>(_FailingHomework());
      await pumpApp(t);
      await tab(t, 'Academics');
      await t.tap(find.text('Homework').first);
      await t.pumpAndSettle();
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('loading placeholder is shown while data is on its way', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      getIt.unregister<ITimetableRepository>();
      getIt.registerSingleton<ITimetableRepository>(_SlowTimetable());
      await pumpApp(t);
      await tab(t, 'Academics');
      await t.tap(find.text('Timetable').first);
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
