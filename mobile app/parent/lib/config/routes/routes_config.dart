import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../design_system/design_system.dart';
import '../../modules/attendance/screens/attendance_screen.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/auth/screens/forgot_password_screen.dart';
import '../../modules/auth/screens/login_screen.dart';
import '../../modules/fees/screens/fees_screen.dart';
import '../../modules/home/screens/home_screen.dart';
import '../../modules/homework/screens/homework_detail_screen.dart';
import '../../modules/inbox/screens/inbox_screen.dart';
import '../../modules/leave/screens/leave_apply_screen.dart';
import '../../modules/leave/screens/leave_screen.dart';
import '../../modules/learn/screens/learn_screen.dart';
import '../../modules/live_classes/screens/live_classes_screen.dart';
import '../../modules/marks/screens/marks_detail_screen.dart';
import '../../modules/messages/screens/chat_screen.dart';
import '../../modules/more/screens/more_screen.dart';
import '../../modules/profile/screens/profile_screen.dart';
import 'routes.dart';

const _tabs = [
  AppNavItem(Icons.home_outlined, Icons.home_rounded, 'Home'),
  AppNavItem(
    Icons.event_available_outlined,
    Icons.event_available_rounded,
    'Attendance',
  ),
  AppNavItem(Icons.menu_book_outlined, Icons.menu_book_rounded, 'Learn'),
  AppNavItem(Icons.inbox_outlined, Icons.inbox_rounded, 'Inbox'),
  AppNavItem(Icons.grid_view_outlined, Icons.grid_view_rounded, 'More'),
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

/// Auth guard: signed-out users only see login / forgot password; signed-in users skip them.
String? authRedirect(AuthState auth, String location) {
  if (auth.status == AuthStatus.unknown) return null;
  final signedIn = auth.isAuthenticated;
  if (!signedIn && !RoutePaths.isPublic(location)) return RoutePaths.login;
  if (signedIn && RoutePaths.isPublic(location)) return RoutePaths.home;
  return null;
}

GoRouter createRouter(
  AuthBloc auth, {
  String initialLocation = RoutePaths.home,
}) => GoRouter(
  initialLocation: initialLocation,
  refreshListenable: GoRouterRefreshStream(auth.stream),
  redirect: (context, state) => authRedirect(auth.state, state.matchedLocation),
  routes: [
    GoRoute(
      path: RoutePaths.login,
      builder: (_, _) => const LoginScreen(),
      routes: [
        GoRoute(
          path: 'forgot',
          builder: (_, _) => const ForgotPasswordScreen(),
        ),
      ],
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AdaptiveScaffold(
        navigationShell: shell,
        destinations: _tabs,
        title: 'Parent Portal',
      ),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: RoutePaths.home,
              builder: (_, _) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: RoutePaths.attendance,
              builder: (_, _) => const AttendanceScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: RoutePaths.learn,
              builder: (_, s) =>
                  LearnScreen(section: s.uri.queryParameters['section']),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: RoutePaths.inbox,
              builder: (_, s) =>
                  InboxScreen(section: s.uri.queryParameters['section']),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: RoutePaths.more,
              builder: (_, _) => const MoreScreen(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: RoutePaths.homeworkDetail,
      builder: (_, s) => HomeworkDetailScreen(id: s.pathParameters['id']!),
    ),
    GoRoute(
      path: RoutePaths.marksDetail,
      builder: (_, s) => MarksDetailScreen(id: s.pathParameters['id']!),
    ),
    GoRoute(
      path: RoutePaths.chat,
      builder: (_, s) => ChatScreen(
        threadId: s.pathParameters['id']!,
        teacher: s.uri.queryParameters['teacher'],
        role: s.uri.queryParameters['role'],
      ),
    ),
    GoRoute(
      path: RoutePaths.liveClasses,
      builder: (_, _) => const LiveClassesScreen(),
    ),
    // /more/leave/apply must be matched before /more/leave is considered a prefix: both are exact routes.
    GoRoute(
      path: RoutePaths.leaveApply,
      builder: (_, _) => const LeaveApplyScreen(),
    ),
    GoRoute(path: RoutePaths.leave, builder: (_, _) => const LeaveScreen()),
    GoRoute(path: RoutePaths.fees, builder: (_, _) => const FeesScreen()),
    GoRoute(path: RoutePaths.profile, builder: (_, _) => const ProfileScreen()),
  ],
  errorBuilder: (context, state) => DetailScaffold(
    title: 'Page not found',
    body: AppEmptyState(
      'Nothing here yet',
      hint: 'No screen for ${state.uri}',
      icon: Icons.explore_off_outlined,
    ),
  ),
);
