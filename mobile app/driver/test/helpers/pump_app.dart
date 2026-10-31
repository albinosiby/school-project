import 'package:driver_app/config/routes/routes_config.dart';
import 'package:driver_app/di/demo_data.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/modules/auth/bloc/auth_bloc.dart';
import 'package:driver_app/utils/services/link_launcher.dart';
import 'package:driver_app/utils/services/mock_latency.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeLauncher implements LinkLauncher {
  FakeLauncher({this.succeeds = true});
  final bool succeeds;
  final List<String> opened = [];

  @override
  Future<bool> open(String url) async {
    opened.add(url);
    return succeeds;
  }
}

/// Fresh DI container with the mock repositories and no simulated latency.
/// [signedInAs] restores a saved session (crew id) as after a restart.
Future<FakeLauncher> setUpTestApp({String? signedInAs, bool launcherSucceeds = true, DemoStore? store}) async {
  GoogleFonts.config.allowRuntimeFetching = false;
  MockLatency.delay = Duration.zero;
  SharedPreferences.setMockInitialValues({'driver_session_crew': ?signedInAs});
  final launcher = FakeLauncher(succeeds: launcherSucceeds);
  await configureDependencies(linkLauncher: launcher, store: store);
  getIt<AuthBloc>().add(const AuthStarted());
  await getIt<AuthBloc>().stream.firstWhere((s) => s.status != AuthStatus.unknown);
  return launcher;
}

/// Test fonts are wider than the design font, so overflow reports are not meaningful here.
void ignoreOverflow() {
  final old = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    old?.call(d);
  };
  addTearDown(() => FlutterError.onError = old);
}

/// Pumps the whole app (router + guard) at the phone design size.
Future<void> pumpApp(WidgetTester tester, {String? location}) async {
  ignoreOverflow();
  tester.view.physicalSize = const Size(402, 874);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = createRouter(getIt<AuthBloc>(), initialLocation: location ?? '/home');
  await tester.pumpWidget(DriverApp(router: router));
  await tester.pumpAndSettle();
}

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pumpAndSettle(const Duration(milliseconds: 100));
}

/// Scrolls the vertical list until [finder] is built and visible (lists are longer than the phone), then taps it.
Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  final list = find.byWidgetPredicate((w) => w is ListView && w.scrollDirection == Axis.vertical).last;
  for (var i = 0; i < 25 && finder.evaluate().isEmpty; i++) {
    await tester.drag(list, const Offset(0, -250), warnIfMissed: false);
    await tester.pumpAndSettle();
  }
  for (var i = 0; i < 50 && finder.evaluate().isEmpty; i++) {
    await tester.drag(list, const Offset(0, 250), warnIfMissed: false);
    await tester.pumpAndSettle();
  }
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}
