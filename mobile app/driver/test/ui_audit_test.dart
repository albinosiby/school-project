import 'dart:convert';
import 'dart:io';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/core/models/view_model.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'helpers/preload_views.dart';
import 'support/audit_harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Map<String, ScreenModel> screens;
  setUpAll(() async {
    configureDependencies();
    await preloadViews();
    screens = await loadAuditScreens();
    GoogleFonts.config.allowRuntimeFetching = false;
    await GoogleFonts.pendingFonts([
      for (final w in FontWeight.values.where(
        (w) => w.value >= 200 && w.value <= 800,
      ))
        GoogleFonts.plusJakartaSans(fontWeight: w),
    ]);
  });
  testWidgets(
    'all controls can receive pointer input after scrolling',
    (tester) async {
      tester.view.physicalSize = const Size(432, 960);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.15;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final result = await auditReachability(tester, screens: screens);
      await tester.runAsync(() async {
        await Directory('build/ui_audit').create(recursive: true);
        await File(
          'build/ui_audit/local_reachability.json',
        ).writeAsString(const JsonEncoder.withIndent('  ').convert(result));
      });
      final failed = result.where((r) => r['result'] != 'reachable').toList();
      expect(
        failed,
        isEmpty,
        reason:
            '${failed.length} controls are unreachable; see build/ui_audit/local_reachability.json',
      );
    },
    timeout: const Timeout(Duration(minutes: 12)),
  );
}
