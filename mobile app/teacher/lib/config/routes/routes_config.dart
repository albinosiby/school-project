import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/app_config.dart';
import '../../design_system/design_system.dart';
import '../../di/injection.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/bloc/auth_states.dart';
import '../../modules/classes/screens/classes_screen.dart';
import '../../modules/home/screens/home_screen.dart';
import '../../modules/home/screens/timetable_screen.dart';
import '../../modules/more/screens/more_screen.dart';
import '../../modules/showcase/screens/showcase_screen.dart';
import '../../modules/tasks/screens/tasks_screen.dart';
import '../../utils/helpers/stream_listenable.dart';
import '../../utils/services/local_storage_service.dart';
import 'modules/attendance_routes.dart';
import 'modules/auth_routes.dart';
import 'modules/classes_routes.dart';
import 'modules/engage_routes.dart';
import 'modules/home_routes.dart';
import 'modules/lessons_routes.dart';
import 'modules/tasks_routes.dart';
import 'routes.dart';

const _tabs = [
  AppNavItem(Icons.home_outlined, Icons.home_rounded, 'Home'),
  AppNavItem(Icons.calendar_today_outlined, Icons.calendar_today_rounded, 'Timetable'),
  AppNavItem(Icons.menu_book_outlined, Icons.menu_book_rounded, 'Classes'),
  AppNavItem(Icons.check_circle_outline_rounded, Icons.check_circle_rounded, 'Tasks'),
  AppNavItem(Icons.format_list_bulleted_rounded, Icons.format_list_bulleted_rounded, 'More'),
];

/// Auth guard: with the Firebase backend every screen except sign-in / forgot password needs a signed-in teacher.
/// The local backend has no login (guard off), so the demo data and the tests open straight on Home.
String? authRedirect(AuthState auth, String location, {required bool enabled}) {
  if (!enabled) return null;
  final onAuthPage = location == RoutePaths.login || location == RoutePaths.forgotPassword;
  if (!auth.signedIn && !onAuthPage) return RoutePaths.login;
  if (auth.signedIn && onAuthPage) return RoutePaths.home;
  return null;
}

final GoRouter router = GoRouter(
  initialLocation: RoutePaths.home,
  refreshListenable: AppConfig.isFirebase ? StreamListenable(getIt<AuthBloc>().stream) : null,
  redirect: (context, state) {
    final toAuth = authRedirect(getIt<AuthBloc>().state, state.matchedLocation, enabled: AppConfig.isFirebase);
    if (toAuth != null) return toAuth;
    if (AppConfig.isFirebase && !getIt<AuthBloc>().state.signedIn) return null; // sign-in pages skip onboarding
    // First run goes through the walkthrough (core/walk_through) until it is completed.
    final onboarded = getIt<LocalStorageService>().isOnboardingComplete;
    final onOnboarding = state.matchedLocation == RoutePaths.onboarding;
    if (!onboarded && !onOnboarding) return RoutePaths.onboarding;
    if (onboarded && onOnboarding) return RoutePaths.home;
    return null;
  },
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AdaptiveScaffold(navigationShell: shell, destinations: _tabs),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.home, builder: (_, _) => const HomeScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.timetable, builder: (_, _) => const TimetableScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.classes, builder: (_, _) => const ClassesScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.tasks, builder: (_, _) => const TasksScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.more, builder: (_, _) => const MoreScreen())]),
      ],
    ),
    GoRoute(path: RoutePaths.showcase, builder: (_, _) => const ShowcaseScreen()),
    // Module routes. Order matters where paths overlap: /homework/new (classes) before /homework/:id (tasks).
    ...authRoutes,
    ...homeRoutes,
    ...classesRoutes,
    ...tasksRoutes,
    ...attendanceRoutes,
    ...lessonsRoutes,
    ...engageRoutes,
  ],
  errorBuilder: (context, state) => DetailScaffold(
    title: 'Page not found',
    body: AppEmptyState('Nothing here yet', hint: 'No screen for ${state.uri}', icon: Icons.explore_off_outlined),
  ),
);
