import 'package:driver_app/config/routes/routes.dart';
import 'package:driver_app/config/routes/routes_config.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/modules/auth/cubit/session_cubit.dart';
import 'package:driver_app/modules/transport/repositories/trip_repository.dart';
import 'package:driver_app/modules/transport/models/trip_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import '../helpers/preload_views.dart';
import 'audit_harness.dart';

void registerEndToEndScenarios({void Function(String, String)? observe}) {
  int serial = 0;
  GoRouter router(WidgetTester t) =>
      t.widget<MaterialApp>(find.byType(MaterialApp)).routerConfig! as GoRouter;
  Future<void> settle(WidgetTester t) async {
    await t.runAsync(preloadViews);
    await t.pumpAndSettle();
  }

  Future<void> tap(WidgetTester t, Finder f) async {
    expect(f, findsWidgets);
    await Scrollable.ensureVisible(t.element(f.first), alignment: .5);
    await settle(t);
    expect(f.first.hitTestable(), findsOneWidget);
    await t.tap(f.first);
    await settle(t);
    expect(t.takeException(), isNull);
  }

  Future<void> action(WidgetTester t, String id) =>
      tap(t, find.byKey(ValueKey('action:$id')));
  Future<void> input(WidgetTester t, String id, String value) async {
    final f = find.byKey(ValueKey(id));
    await Scrollable.ensureVisible(t.element(f), alignment: .5);
    await t.enterText(f, value);
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t);
  }

  Future<void> start(WidgetTester t, String id) async {
    await t.pumpWidget(const SizedBox.shrink());
    await settle(t);
    await seedRole(id);
    await t.runAsync(preloadViews);
    await t.pumpWidget(
      DriverApp(
        key: ValueKey('scenario-${serial++}'),
        initialLocation: AppRoutes.path(id),
      ),
    );
    await settle(t);
  }

  Future<void> follow(WidgetTester t, String source, String target) async {
    final model = (await t.runAsync(loadAuditScreens))![source]!;
    final n = controls(
      model.root,
    ).firstWhere((n) => n.action == 'route:$target');
    await action(t, n.id);
  }

  Future<void> back(WidgetTester t, String id) async {
    final model = (await t.runAsync(loadAuditScreens))![id]!;
    final n = controls(model.root).firstWhere((n) => n.action == 'back');
    await action(t, n.id);
  }

  Future<void> menu(WidgetTester t, String item) async {
    await tap(t, find.byTooltip('Account options'));
    await tap(t, find.text(item));
  }

  Future<void> close(WidgetTester t) async {
    await t.pumpWidget(const SizedBox.shrink());
    await settle(t);
  }

  testWidgets('E2E auth: validation, resend, pairing and primary role guards', (
    t,
  ) async {
    await getIt<SessionCubit>().signOut();
    clearSessionData();
    await t.runAsync(preloadViews);
    await t.pumpWidget(DriverApp(key: ValueKey('auth-${serial++}')));
    await settle(t);
    await tap(t, find.text('Get Started'));
    await t.enterText(find.byType(TextFormField).first, '123');
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t);
    await action(t, '1174_7753');
    expect(find.text('Enter a valid 10-digit mobile number.'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, '9123456789');
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t);
    await action(t, '1174_7753');
    expect(find.text('+91 91234 56789'), findsOneWidget);
    for (var i = 0; i < 6; i++) {
      await t.enterText(find.byType(TextFormField).at(i), '0');
    }
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t);
    await action(t, '1174_7886');
    expect(find.text('Use demo code 482916.'), findsOneWidget);
    await action(t, '1174_7879');
    for (var i = 0; i < 6; i++) {
      await t.enterText(find.byType(TextFormField).at(i), '482916'[i]);
    }
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t);
    await action(t, '1174_7886');
    await tap(t, find.text('Lead Driver'));
    await tap(t, find.textContaining('Confirm Pairing'));
    expect(
      router(t).routerDelegate.currentConfiguration.last.matchedLocation,
      '/driver/home',
    );
    expect(getIt<SessionCubit>().state.phone, '9123456789');
    router(t).go('/assistant/home');
    await settle(t);
    if (!uiReview) {
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/driver/home',
      );
    }
    observe?.call('auth_validation_resend_pairing', 'passed');
    await close(t);
  });

  testWidgets(
    'E2E driver: checklist, boarding retention, end-trip gates and history',
    (t) async {
      getIt<TripRepository>().clear();
      await start(t, '5271');
      await tap(t, find.byKey(const ValueKey('nav:1')));
      await tap(t, find.textContaining(RegExp(r'Start\s+Morning\s+Trip')));
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/screen/9783',
      );
      await action(t, '1174_9986');
      await action(t, '1174_10004');
      expect(getIt<TripRepository>().current.checked.length, 2);
      await action(t, '1174_10012');
      await tap(t, find.textContaining(RegExp(r'Start\s+Morning\s+Trip')));
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/driver/live',
      );
      await action(t, '1174_6690');
      expect(getIt<TripRepository>().current.boarded.length, 1);
      expect(find.text('1 Student Onboard'), findsOneWidget);
      await tap(t, find.byKey(const ValueKey('nav:1')));
      await tap(t, find.textContaining(RegExp(r'Start\s+Morning\s+Trip')));
      expect(getIt<TripRepository>().current.boarded.length, 1);
      await follow(t, '6416', '14244');
      await action(t, '1174_14500');
      expect(getIt<TripRepository>().current.status, TripStatus.active);
      for (final id in [
        '1174_14349',
        '1174_14359',
        '1174_14369',
        '1174_14379',
      ]) {
        await action(t, id);
      }
      await action(t, '1174_14500');
      expect(getIt<TripRepository>().current.status, TripStatus.completed);
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/screen/10392',
      );
      observe?.call('driver_trip_lifecycle', 'passed');
      await close(t);
    },
  );

  testWidgets(
    'E2E operations: leave validation, standby modal, fault and fuel controls',
    (t) async {
      await start(t, '8132');
      await follow(t, '8132', '8359');
      await action(t, '1174_8475');
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/screen/8132',
      );
      await input(t, '1174_8310', '');
      await action(t, '1174_8347');
      expect(
        find.text('Complete the required details before submitting.'),
        findsOneWidget,
      );
      await input(
        t,
        '1174_8310',
        'Demo appointment; vehicle keys handed to yard master.',
      );
      await action(t, '1174_8347');
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/screen/8483',
      );
      await follow(t, '8483', '8717');
      await back(t, '8717');
      await start(t, '13983');
      await input(t, '1174_14162', '');
      await action(t, '1174_14219');
      expect(
        find.text('Complete the required details before submitting.'),
        findsOneWidget,
      );
      await input(t, '1174_14162', 'Demo brake observation for review.');
      await action(t, '1174_14219');
      expect(find.text('Saved for this demo session.'), findsOneWidget);
      await start(t, '12538');
      await input(t, '1174_12692', '10');
      await action(t, '1174_12705');
      expect(
        t
            .widget<TextFormField>(find.byKey(const ValueKey('1174_12692')))
            .controller!
            .text,
        '15.0',
      );
      await action(t, '1174_12703');
      expect(
        t
            .widget<TextFormField>(find.byKey(const ValueKey('1174_12692')))
            .controller!
            .text,
        '10.0',
      );
      await action(t, '1174_12708');
      expect(
        t
            .widget<TextFormField>(find.byKey(const ValueKey('1174_12692')))
            .controller!
            .text,
        '41.6',
      );
      await action(t, '1174_12601');
      expect(find.text('Saved for this demo session.'), findsOneWidget);
      observe?.call('operations_forms_and_fuel', 'passed');
      await close(t);
    },
  );

  testWidgets(
    'E2E account: profile draft, saved preferences, pass popup and logout',
    (t) async {
      await start(t, '6922');
      await menu(t, 'Edit profile');
      await input(t, '1174_9026', 'Audit Demo Driver');
      await action(t, '1174_9167');
      expect(find.text('Saved for this demo session.'), findsOneWidget);
      await back(t, '8924');
      observe?.call(
        'profile_overview_updates',
        find.text('Audit Demo Driver').evaluate().isEmpty
            ? 'preview_only_overview_is_fixture'
            : 'passed',
      );
      await menu(t, 'Edit profile');
      expect(
        t
            .widget<TextFormField>(find.byKey(const ValueKey('1174_9026')))
            .controller!
            .text,
        'Audit Demo Driver',
      );
      await back(t, '8924');
      await menu(t, 'Settings');
      await action(t, '1174_9232');
      await action(t, '1174_9372');
      await back(t, '9182');
      await menu(t, 'Settings');
      expect(
        t
            .widget<Semantics>(find.byKey(const ValueKey('action:1174_9232')))
            .properties
            .selected,
        true,
      );
      await back(t, '9182');
      await menu(t, 'Pair or take over trip');
      await input(t, '1174_15665', '0');
      await action(t, '1174_15777');
      expect(
        find.text(
          'Use demo pairing PIN 842910. No hardware handshake is performed.',
        ),
        findsOneWidget,
      );
      for (final item in {
        '1174_15665': '8',
        '1174_15667': '4',
        '1174_15669': '2',
        '1174_15671': '9',
        '1174_15673': '1',
        '1174_15675': '0',
      }.entries) {
        await input(t, item.key, item.value);
      }
      await action(t, '1174_15777');
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/driver/home',
      );
      await tap(t, find.byKey(const ValueKey('nav:3')));
      await menu(t, 'Digital pass');
      await follow(t, '9484', '9679');
      await back(t, '9679');
      await back(t, '9484');
      await action(t, '1174_7332');
      expect(find.text('Get Started'), findsOneWidget);
      router(t).go('/driver/home');
      await settle(t);
      if (!uiReview) expect(find.text('Get Started'), findsOneWidget);
      observe?.call('account_drafts_preferences_logout', 'passed');
      await close(t);
    },
  );

  testWidgets(
    'E2E assistant: navigation, guardian rejection, roster, sweep and swap',
    (t) async {
      getIt<TripRepository>().clear();
      await start(t, '6922');
      await menu(t, 'Change crew role');
      await tap(t, find.text('Bus Attendant'));
      await tap(t, find.textContaining('Confirm Pairing'));
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/assistant/home',
      );
      for (final i in [1, 2, 3, 0]) {
        await tap(t, find.byKey(ValueKey('nav:$i')));
      }
      await follow(t, '4', '1433');
      await input(t, '1174_1604', '0000');
      await action(t, '1174_1607');
      expect(find.text('Demo handover code is 4092.'), findsOneWidget);
      await action(t, '1174_1615');
      expect(getIt<TripRepository>().current.handedOver, isEmpty);
      await input(t, '1174_1604', '4092');
      await action(t, '1174_1607');
      expect(find.text('Demo guardian handover verified.'), findsOneWidget);
      expect(getIt<TripRepository>().current.handedOver.length, 1);
      await Scrollable.ensureVisible(
        t.element(find.text('Tanya Verma')),
        alignment: .5,
      );
      await settle(t);
      expect(find.text('Tanya Verma').hitTestable(), findsOneWidget);
      await start(t, '2980');
      await action(t, '1174_3314');
      expect(
        find.text('Check all cabin zones before completing the sweep.'),
        findsOneWidget,
      );
      for (final id in ['1174_3138', '1174_3150', '1174_3162']) {
        await action(t, id);
      }
      await action(t, '1174_3314');
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/assistant/duties',
      );
      await follow(t, '4193', '4589');
      await action(t, '1174_4759');
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/assistant/duties',
      );
      await start(t, '4');
      await follow(t, '4', '330');
      await tap(t, find.byTooltip('Notification options'));
      await tap(t, find.text('Route diversion bulletin'));
      expect(
        router(t).routerDelegate.currentConfiguration.last.matchedLocation,
        '/screen/729',
      );
      observe?.call('assistant_handover_sweep_swap', 'passed');
      await close(t);
    },
  );

  testWidgets(
    'E2E distinguishes working controls from preview-only search and filtering',
    (t) async {
      await start(t, '4772');
      final fields = find.byType(TextFormField);
      expect(fields, findsWidgets);
      final before = t
          .widgetList<Text>(find.byType(Text))
          .map((w) => w.data ?? w.textSpan?.toPlainText() ?? '')
          .join('|');
      await t.enterText(fields.first, 'no-such-student-audit');
      FocusManager.instance.primaryFocus?.unfocus();
      await settle(t);
      final after = t
          .widgetList<Text>(find.byType(Text))
          .map((w) => w.data ?? w.textSpan?.toPlainText() ?? '')
          .join('|');
      observe?.call(
        'student_search_filters_records',
        before == after
            ? 'preview_only_query_does_not_filter_records'
            : 'changed',
      );
      await action(t, '1174_4862');
      observe?.call(
        'student_filter',
        'preview_selection_only_no_repository_filter',
      );
      await close(t);
    },
  );
}
