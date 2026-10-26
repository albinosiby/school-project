import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:teacher_app/design_system/design_system.dart' show AppTheme;
import 'package:teacher_app/di/global_blocs.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/di/seed_data.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';

/// Fresh DI container with an in-memory database seeded from every module.
Future<LocalDatabaseService> setUpTestApp() async {
  SharedPreferences.setMockInitialValues({'onboarding_complete': true});
  final db = LocalDatabaseService.memory(buildSeed());
  await configureDependencies(db: db);
  return db;
}

/// Pumps [screen] (or a GoRouter starting at [location] with [routes]) at the 390x844 design size
/// with the global BLoCs provided. Text uses the test font, so overflow checks are not meaningful.
Future<void> pumpScreen(WidgetTester tester, {Widget? screen, String? location, List<RouteBase> routes = const []}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = screen != null ? null : GoRouter(initialLocation: location ?? '/', routes: routes);
  await tester.pumpWidget(ScreenUtilInit(
    designSize: const Size(390, 844),
    builder: (_, _) => MultiBlocProvider(
      providers: globalBlocProviders(),
      child: router == null
          ? MaterialApp(theme: AppTheme.light, home: screen)
          : MaterialApp.router(theme: AppTheme.light, routerConfig: router),
    ),
  ));
  await tester.pumpAndSettle();
}
