import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../design_system/design_system.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/screens/forgot_password_screen.dart';
import '../../modules/auth/screens/login_screen.dart';
import '../../modules/auth/screens/welcome_screen.dart';
import '../../modules/crew_attendance/screens/crew_attendance_screen.dart';
import '../../modules/home/screens/home_screen.dart';
import '../../modules/leave/screens/apply_leave_screen.dart';
import '../../modules/leave/screens/leave_screen.dart';
import '../../modules/notices/screens/notice_detail_screen.dart';
import '../../modules/notices/screens/notices_screen.dart';
import '../../modules/profile/screens/edit_profile_screen.dart';
import '../../modules/profile/screens/profile_screen.dart';
import '../../modules/students/screens/stops_screen.dart';
import '../../modules/students/screens/students_screen.dart';
import '../../modules/trips/screens/checklist_screen.dart';
import '../../modules/trips/screens/trip_detail_screen.dart';
import '../../modules/trips/screens/trip_history_screen.dart';
import '../../modules/trips/screens/trips_screen.dart';
import 'routes.dart';

final _tabs = [
  AppNavItem(Icons.home_outlined, Icons.home_rounded, 'Home'),
  AppNavItem(Icons.route_outlined, Icons.route_rounded, 'Trips'),
  AppNavItem(Icons.groups_outlined, Icons.groups_rounded, 'Students'),
  AppNavItem(Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
];

/// Re-runs the router redirect whenever [stream] emits.
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _sub = stream.asBroadcastStream().listen((_) => notifyListeners());
  }
  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

/// Auth guard: signed-out users only see welcome / login; signed-in users skip them.
String? authRedirect(AuthState auth, String location) {
  if (auth.status == AuthStatus.unknown) return null;
  final signedIn = auth.isAuthenticated;
  if (!signedIn && !RoutePaths.isPublic(location)) return RoutePaths.signedOutHome;
  if (signedIn && RoutePaths.isPublic(location)) return RoutePaths.signedInHome;
  return null;
}

GoRouter createRouter(AuthBloc auth, {String initialLocation = RoutePaths.home}) => GoRouter(
  initialLocation: initialLocation,
  refreshListenable: GoRouterRefreshStream(auth.stream),
  redirect: (context, state) => authRedirect(auth.state, state.matchedLocation),
  routes: [
    GoRoute(path: RoutePaths.welcome, builder: (_, _) => const WelcomeScreen()),
    GoRoute(path: RoutePaths.login, builder: (_, _) => const LoginScreen(), routes: [
      GoRoute(path: 'forgot', builder: (_, _) => const ForgotPasswordScreen()),
    ]),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AdaptiveScaffold(navigationShell: shell, destinations: _tabs, title: 'Shift Sync'),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.home, builder: (_, _) => const HomeScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.trips, builder: (_, _) => const TripsScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.students, builder: (_, _) => const StudentsScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.profile, builder: (_, _) => const ProfileScreen())]),
      ],
    ),
    // pushed screens (fixed paths before their ":id" siblings)
    GoRoute(path: RoutePaths.tripHistory, builder: (_, _) => const TripHistoryScreen()),
    GoRoute(path: '/trips/:id', builder: (_, s) => TripDetailScreen(tripId: s.pathParameters['id']!)),
    GoRoute(path: '/trips/:id/checklist', builder: (_, s) => ChecklistScreen(tripId: s.pathParameters['id']!)),
    GoRoute(path: RoutePaths.stops, builder: (_, _) => const StopsScreen()),
    GoRoute(path: RoutePaths.attendance, builder: (_, _) => const CrewAttendanceScreen()),
    GoRoute(path: RoutePaths.leave, builder: (_, _) => const LeaveScreen()),
    GoRoute(path: RoutePaths.applyLeave, builder: (_, _) => const ApplyLeaveScreen()),
    GoRoute(path: RoutePaths.notices, builder: (_, _) => const NoticesScreen()),
    GoRoute(path: '/notices/:id', builder: (_, s) => NoticeDetailScreen(id: s.pathParameters['id']!)),
    GoRoute(path: RoutePaths.editProfile, builder: (_, _) => const EditProfileScreen()),
  ],
  errorBuilder: (context, state) => DetailScaffold(
    title: 'Page not found',
    body: AppEmptyState('Nothing here yet', hint: 'No screen for ${state.uri}', icon: Icons.explore_off_outlined),
  ),
);
