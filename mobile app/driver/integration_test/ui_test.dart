import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/config/routes/routes.dart';
import 'package:driver_app/config/routes/view_catalog.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder.first);
    await tester.pumpAndSettle();
    await tester.tap(finder.first);
    await tester.pumpAndSettle();
  }

  testWidgets('sign in and switch between driver and assistant journeys', (
    tester,
  ) async {
    configureDependencies();
    GoogleFonts.config.allowRuntimeFetching = false;
    await tester.pumpWidget(const DriverApp());
    await tester.pumpAndSettle();
    await tap(tester, find.text('Get Started'));
    await tester.enterText(find.byType(TextFormField).first, '9876543210');
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tap(tester, find.text('Sign In'));
    final fields = find.byType(TextFormField);
    expect(fields, findsNWidgets(6));
    for (var i = 0; i < 6; i++) {
      await tester.enterText(fields.at(i), '482916'[i]);
    }
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
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
    await tap(tester, find.text('Guardian Handover'));
    final otp = find.byKey(const ValueKey('1174_1604'));
    await tester.ensureVisible(otp);
    await tester.enterText(otp, '4092');
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tap(tester, find.text('Verify OTP'));
    expect(find.text('Demo guardian handover verified.'), findsOneWidget);
    await tester.ensureVisible(find.text('Tanya Verma'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  testWidgets('all 62 design frames render on the wireless device', (
    tester,
  ) async {
    configureDependencies();
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
    bool converted = false;
    const captures = {
      '7566',
      '7629',
      '7759',
      '5271',
      '4',
      '5638',
      '6416',
      '6922',
      '1433',
      '2296',
      '9783',
      '8132',
      '8924',
      '2980',
    };
    for (final id in viewCatalog.keys) {
      await tester.pumpWidget(
        DriverApp(key: ValueKey(id), initialLocation: AppRoutes.path(id)),
      );
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      expect(
        find.byType(CircularProgressIndicator),
        findsNothing,
        reason: 'Frame $id loaded',
      );
      expect(
        tester.takeException(),
        isNull,
        reason: 'Frame $id ${viewCatalog[id]!.title}',
      );
      if (captures.contains(id)) {
        if (!converted) {
          await binding.convertFlutterSurfaceToImage();
          converted = true;
          await tester.pumpAndSettle();
        }
        await binding.takeScreenshot(id);
      }
      final scrolls = find.byType(Scrollable).hitTestable();
      if (scrolls.evaluate().isNotEmpty) {
        await tester.drag(scrolls.first, const Offset(0, -320));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: 'Frame $id scrolls');
      }
      debugPrint('Verified device frame $id: ${viewCatalog[id]!.title}');
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    }
  });
}
