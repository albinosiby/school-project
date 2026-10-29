import 'helpers/preload_views.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/modules/auth/cubit/session_cubit.dart';
import 'package:driver_app/modules/auth/models/auth_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    configureDependencies();
    await preloadViews();
    GoogleFonts.config.allowRuntimeFetching = false;
    await GoogleFonts.pendingFonts([
      for (final w in [
        FontWeight.w400,
        FontWeight.w500,
        FontWeight.w600,
        FontWeight.w700,
        FontWeight.w800,
      ])
        GoogleFonts.plusJakartaSans(fontWeight: w),
    ]);
  });
  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder.first);
    await tester.pumpAndSettle();
    await tester.tap(finder.first);
    await tester.pumpAndSettle();
  }

  testWidgets('sign in and switch between driver and assistant journeys', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(402, 874);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const DriverApp());
    await tester.pumpAndSettle();
    await tap(tester, find.text('Get Started'));
    await tester.enterText(find.byType(TextFormField).first, '9876543210');
    tester.testTextInput.hide();
    await tap(tester, find.text('Sign In'));
    final fields = find.byType(TextFormField);
    expect(fields, findsNWidgets(6));
    for (var i = 0; i < 6; i++) {
      await tester.enterText(fields.at(i), '482916'[i]);
    }
    tester.testTextInput.hide();
    await tap(tester, find.text('Verify & Sign In'));
    await tap(tester, find.text('Lead Driver'));
    await tap(tester, find.textContaining('Confirm Pairing'));
    expect(find.textContaining('Welcome'), findsWidgets);
    await tap(tester, find.text('Profile'));
    await tap(tester, find.byTooltip('Account options'));
    await tap(tester, find.text('Change crew role'));
    await tap(tester, find.text('Bus Attendant'));
    await tap(tester, find.textContaining('Confirm Pairing'));
    expect(find.text('Companion Actions'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  testWidgets('guardian code verifies and the long roster scrolls', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(402, 874);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final session = getIt<SessionCubit>();
    await session.requestCode('9876543210');
    await session.verify('482916');
    await session.chooseRole(CrewRole.assistant);
    await tester.pumpWidget(const DriverApp(initialLocation: '/screen/1433'));
    await tester.pumpAndSettle();
    final otp = find.byKey(const ValueKey('1174_1604'));
    await tester.ensureVisible(otp);
    await tester.enterText(otp, '4092');
    tester.testTextInput.hide();
    await tap(tester, find.text('Verify OTP'));
    expect(find.text('Demo guardian handover verified.'), findsOneWidget);
    await tester.ensureVisible(find.text('Tanya Verma'));
    await tester.pumpAndSettle();
    expect(tester.getRect(find.text('Tanya Verma')).bottom, lessThan(874));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  testWidgets('leave form scrolls to a reachable submit action', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(402, 874);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final session = getIt<SessionCubit>();
    await session.requestCode('9876543210');
    await session.verify('482916');
    await session.chooseRole(CrewRole.driver);
    await tester.pumpWidget(const DriverApp(initialLocation: '/screen/8132'));
    await tester.pumpAndSettle();
    final submit = find.text('Submit Leave Application');
    await tester.ensureVisible(submit);
    await tester.pumpAndSettle();
    expect(submit.hitTestable(), findsOneWidget);
    expect(tester.getRect(submit).bottom, lessThan(874));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
