import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/config/routes/routes_config.dart';
import 'package:teacher_app/design_system/design_system.dart';
import 'package:teacher_app/di/global_blocs.dart';
import 'helpers/pump_app.dart';

void ignoreOverflow() {
  final prev = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    prev?.call(d);
  };
  addTearDown(() => FlutterError.onError = prev);
}

/// A phone held sideways (915x412 dp): side rail instead of the dock, and the tab screens in two columns.
Future<void> _pumpLandscape(WidgetTester t, String location) async {
  ignoreOverflow(); // the test font is wider than the app font
  t.view.physicalSize = const Size(915, 412);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(ScreenUtilInit(
    designSize: const Size(915, 412), // main.dart: sideways phones are not scaled up
    builder: (_, _) => MultiBlocProvider(providers: globalBlocProviders(), child: MaterialApp.router(theme: AppTheme.light, routerConfig: router)),
  ));
  router.go(location);
  await t.pumpAndSettle();
}

/// [right] sits in a column to the right of [left] (two-column layout).
void expectSideBySide(WidgetTester t, Finder left, Finder right) {
  expect(left, findsWidgets);
  expect(right, findsWidgets);
  expect(t.getTopLeft(right.first).dx, greaterThan(t.getTopLeft(left.first).dx + 200));
}

void main() {
  setUp(setUpTestApp);

  testWidgets('home: rail navigation, today on the left, tasks and classes on the right', (t) async {
    await _pumpLandscape(t, RoutePaths.home);
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(AppDock), findsNothing);
    expectSideBySide(t, find.text("Today's Schedule"), find.text('Pending Action Tasks'));
    expectSideBySide(t, find.text("Today's Schedule"), find.text('My Assigned Classes'));
  });

  testWidgets('timetable: day strip left, timeline right', (t) async {
    await _pumpLandscape(t, RoutePaths.timetable);
    expectSideBySide(t, find.text('Daily View'), find.textContaining('Schedule Timeline', findRichText: true));
  });

  testWidgets('classes: class list left, class hub right', (t) async {
    await _pumpLandscape(t, RoutePaths.classes);
    expectSideBySide(t, find.text('ACADEMIC CYCLE'), find.textContaining('Class Roster'));
  });

  testWidgets('tasks and more use both columns; the rail switches tabs', (t) async {
    await _pumpLandscape(t, RoutePaths.tasks);
    expect(find.text('Weekly Workload'), findsOneWidget);
    await _pumpLandscape(t, RoutePaths.more);
    expect(find.byType(NavigationRail), findsOneWidget);
    await t.tap(find.byIcon(Icons.home_outlined).first);
    await t.pumpAndSettle();
    expect(find.text('Teacher Portal'), findsOneWidget);
  });

  testWidgets('side navigation stays in the semantics tree (rail and desktop drawer)', (t) async {
    final sem = t.ensureSemantics();
    await _pumpLandscape(t, RoutePaths.timetable);
    expect(find.bySemanticsLabel(RegExp(r'^Classes')), findsWidgets);
    t.view.physicalSize = const Size(1280, 800);
    await t.pumpAndSettle();
    expect(find.byType(NavigationDrawer), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Classes')), findsWidgets);
    // each card is its own node: the "now" card does not swallow the timeline column next to it
    final now = t.getSemantics(find.bySemanticsLabel(RegExp('NOW HAPPENING')).first);
    expect(now.label, isNot(contains('Lunch Break')));
    sem.dispose();
  });
}
