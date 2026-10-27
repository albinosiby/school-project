import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/attendance/bloc/attendance_bloc.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/modules/family/bloc/family_bloc.dart';
import 'package:parent_app/modules/family/screens/select_child_screen.dart';
import 'package:parent_app/modules/family/screens/widgets/parent_tab_header.dart';
import 'package:parent_app/modules/homework/bloc/homework_bloc.dart';
import 'helpers/pump_app.dart';

/// A tab-like page with the parent header, plus the routes the header opens (stubs except Select Student).
Future<GoRouter> _pumpHeader(WidgetTester t) async {
  ignoreOverflow();
  t.view.physicalSize = const Size(402, 874);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  getIt<FamilyBloc>().add(const LoadFamily());
  Widget stub(String s) => Scaffold(body: Center(child: Text('stub $s')));
  final router = GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(
        path: RoutePaths.home,
        builder: (_, _) => Scaffold(
          body: Column(
            children: [
              const ParentTabHeader(title: 'Home'),
              Expanded(
                child: BlocBuilder<FamilyBloc, FamilyState>(
                  builder: (_, s) => Text('showing ${s.selected?.name}'),
                ),
              ),
            ],
          ),
        ),
      ),
      GoRoute(
        path: RoutePaths.selectChild,
        builder: (_, _) => const SelectChildScreen(),
      ),
      GoRoute(
        path: RoutePaths.notifications,
        builder: (_, _) => stub('notifications'),
      ),
      GoRoute(path: RoutePaths.profile, builder: (_, _) => stub('profile')),
    ],
  );
  await t.pumpWidget(
    ScreenUtilInit(
      designSize: const Size(402, 874),
      builder: (_, _) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: getIt<AuthBloc>()),
          BlocProvider.value(value: getIt<FamilyBloc>()),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    ),
  );
  await t.pumpAndSettle();
  return router;
}

void main() {
  group('FamilyBloc', () {
    test('loads Mr. Rajesh Sharma with Aarav selected', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<FamilyBloc>()..add(const LoadFamily());
      final s = await bloc.stream.firstWhere(
        (s) => s.status == LoadStatus.loaded,
      );
      expect(s.guardian?.name, 'Mr. Rajesh Sharma');
      expect(s.children.map((c) => c.firstName), ['Aarav', 'Ananya']);
      expect(s.children.map((c) => c.className), ['10-B', '8-C']);
      expect(s.selected?.id, DemoData.aarav.id);
    });

    test(
      'SelectChild switches the selected child; unknown ids are ignored',
      () async {
        await setUpTestApp(signedIn: true);
        final bloc = getIt<FamilyBloc>()..add(const LoadFamily());
        await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
        bloc.add(SelectChild(DemoData.ananya.id));
        expect(
          (await bloc.stream.firstWhere(
            (s) => s.selected?.id == DemoData.ananya.id,
          )).selected?.name,
          'Ananya Sharma',
        );
        bloc.add(const SelectChild('nope'));
        await Future<void>.delayed(Duration.zero);
        expect(bloc.state.selected?.id, DemoData.ananya.id);
      },
    );

    test('ClearFamily forgets the family and the selection', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<FamilyBloc>()..add(const LoadFamily());
      await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      bloc.add(SelectChild(DemoData.ananya.id));
      await bloc.stream.firstWhere((s) => s.selectedId == DemoData.ananya.id);
      bloc.add(const ClearFamily());
      final s = await bloc.stream.firstWhere((s) => s.family == null);
      expect(s.selected, isNull);
    });
  });

  group('child scoped data', () {
    test('homework differs per child and loads cache-first', () async {
      await setUpTestApp(signedIn: true);
      final a = getIt<HomeworkBloc>()..add(LoadChildData(DemoData.aarav.id));
      final sa = await a.stream.firstWhere((s) => s.hasData);
      final n = getIt<HomeworkBloc>()..add(LoadChildData(DemoData.ananya.id));
      final sn = await n.stream.firstWhere((s) => s.hasData);
      expect(sa.data!.map((h) => h.id), isNot(sn.data!.map((h) => h.id)));
      expect(sa.childId, DemoData.aarav.id);
      expect(sn.childId, DemoData.ananya.id);
    });

    test('switching child on one bloc drops the previous child data', () async {
      await setUpTestApp(signedIn: true);
      final bloc = getIt<AttendanceBloc>()
        ..add(LoadChildData(DemoData.aarav.id));
      await bloc.stream.firstWhere(
        (s) => s.hasData && s.childId == DemoData.aarav.id,
      );
      bloc.add(LoadChildData(DemoData.ananya.id));
      final s = await bloc.stream.firstWhere(
        (s) => s.childId == DemoData.ananya.id && s.hasData,
      );
      expect(s.data!.on(DateTime.now()), isNull); // Ananya: not marked yet
    });
  });

  test('academic year label starts in April', () {
    expect(academicYearLabel(DateTime(2026, 3, 31)), 'AY 2025–26');
    expect(academicYearLabel(DateTime(2026, 4, 1)), 'AY 2026–27');
  });

  group('parent tab header + child switcher', () {
    testWidgets('chips switch the child; bell and avatar open their screens', (
      t,
    ) async {
      await setUpTestApp(signedIn: true);
      final router = await _pumpHeader(t);
      expect(find.text('EduAdmin'), findsOneWidget);
      expect(find.text('showing Aarav Sharma'), findsOneWidget);

      await t.tap(find.byKey(ValueKey('child-chip-${DemoData.ananya.id}')));
      await t.pumpAndSettle();
      expect(find.text('showing Ananya Sharma'), findsOneWidget);

      await t.tap(find.byKey(const Key('header-bell')));
      await t.pumpAndSettle();
      expect(find.text('stub notifications'), findsOneWidget);
      router.pop();
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('header-avatar')));
      await t.pumpAndSettle();
      expect(find.text('stub profile'), findsOneWidget);
    });

    testWidgets(
      '"Switch profile" opens Select Student and returns with the new child',
      (t) async {
        final launcher = await setUpTestApp(signedIn: true);
        await _pumpHeader(t);
        await t.ensureVisible(find.byKey(const Key('switch-profile')));
        await t.tap(find.byKey(const Key('switch-profile')));
        await t.pumpAndSettle();

        expect(find.text('Select Student Profile'), findsOneWidget);
        expect(find.text('Active'), findsOneWidget);
        expect(find.text('Linked Child'), findsOneWidget);
        expect(find.text('Continue with Aarav Sharma'), findsOneWidget);

        await t.tap(find.text('Contact Registrar'));
        await t.pumpAndSettle();
        expect(launcher.opened, hasLength(1));

        await t.tap(find.byKey(ValueKey('select-child-${DemoData.ananya.id}')));
        await t.pump();
        await t.tap(find.text('Continue with Ananya Sharma'));
        await t.pumpAndSettle();
        expect(find.text('showing Ananya Sharma'), findsOneWidget);
        expect(find.text('Now showing Ananya Sharma'), findsOneWidget);
      },
    );

    testWidgets('pushed Select Student has a working back button', (t) async {
      await setUpTestApp(signedIn: true);
      await _pumpHeader(t);
      await t.tap(find.byKey(const Key('switch-profile')));
      await t.pumpAndSettle();
      // Back button is shown because the screen was pushed.
      expect(find.byTooltip('Back'), findsOneWidget);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();
      expect(find.text('showing Aarav Sharma'), findsOneWidget);
    });
  });
}
