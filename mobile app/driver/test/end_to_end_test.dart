import 'dart:convert';
import 'dart:io';
import 'package:driver_app/di/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'helpers/preload_views.dart';
import 'support/end_to_end_scenarios.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final observations = <String, String>{};
  setUpAll(() async {
    configureDependencies();
    await preloadViews();
    GoogleFonts.config.allowRuntimeFetching = false;
    await GoogleFonts.pendingFonts([
      for (final w in FontWeight.values.where(
        (w) => w.value >= 200 && w.value <= 800,
      ))
        GoogleFonts.plusJakartaSans(fontWeight: w),
    ]);
  });
  setUp(() {
    final v =
        TestWidgetsFlutterBinding.instance.platformDispatcher.views.single;
    v.physicalSize = const Size(432, 960);
    v.devicePixelRatio = 1;
    TestWidgetsFlutterBinding
            .instance
            .platformDispatcher
            .textScaleFactorTestValue =
        1.15;
  });
  tearDown(() {
    final v =
        TestWidgetsFlutterBinding.instance.platformDispatcher.views.single;
    v.resetPhysicalSize();
    v.resetDevicePixelRatio();
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearTextScaleFactorTestValue();
  });
  registerEndToEndScenarios(observe: (key, value) => observations[key] = value);
  tearDownAll(() async {
    await Directory('build/ui_audit').create(recursive: true);
    await File(
      'build/ui_audit/local_journeys.json',
    ).writeAsString(const JsonEncoder.withIndent('  ').convert(observations));
  });
}
