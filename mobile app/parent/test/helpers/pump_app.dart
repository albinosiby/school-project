import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:parent_app/config/routes/routes_config.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/main.dart';
import 'package:parent_app/modules/auth/bloc/auth_bloc.dart';
import 'package:parent_app/utils/services/link_launcher.dart';
import 'package:parent_app/utils/services/mock_latency.dart';
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
/// [signedIn] restores a saved session (as after a restart).
Future<FakeLauncher> setUpTestApp({
  bool signedIn = false,
  bool launcherSucceeds = true,
}) async {
  GoogleFonts.config.allowRuntimeFetching = false;
  MockLatency.delay = Duration.zero;
  SharedPreferences.setMockInitialValues({
    if (signedIn) 'parent_session_guardian': 'par_001',
  });
  final launcher = FakeLauncher(succeeds: launcherSucceeds);
  await configureDependencies(linkLauncher: launcher);
  getIt<AuthBloc>().add(const AuthStarted());
  await getIt<AuthBloc>().stream.firstWhere(
    (s) => s.status != AuthStatus.unknown,
  );
  return launcher;
}

/// Test fonts are wider than Inter, so overflow reports are not meaningful here.
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
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = createRouter(
    getIt<AuthBloc>(),
    initialLocation: location ?? '/home',
  );
  await tester.pumpWidget(ParentApp(router: router));
  await tester.pumpAndSettle();
}
