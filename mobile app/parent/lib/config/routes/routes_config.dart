import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../modules/messages/screens/widgets/unread_messages_badge.dart';
import '../../design_system/design_system.dart';
import '../../modules/academics/screens/academics_screen.dart';
import '../../modules/auth/bloc/auth_bloc.dart';
import '../../modules/fees/screens/fees_screen.dart';
import '../../modules/home/screens/home_screen.dart';
import '../../modules/messages/screens/messages_screen.dart';
import '../../modules/more/screens/more_screen.dart';
import 'modules/academics_routes.dart';
import 'modules/auth_routes.dart';
import 'modules/home_routes.dart';
import 'modules/messages_routes.dart';
import 'modules/profile_routes.dart';
import 'modules/student_routes.dart';
import 'routes.dart';

final _tabs = [
  AppNavItem(Icons.home_outlined, Icons.home_rounded, 'Home'),
  AppNavItem(Icons.school_outlined, Icons.school_rounded, 'Academics'),
  AppNavItem(Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, 'Fees'),
  AppNavItem(
    Icons.chat_bubble_outline_rounded,
    Icons.chat_bubble_rounded,
    'Messages',
    badge: (icon) => UnreadMessagesBadge(child: icon),
  ),
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
  if (!signedIn && !RoutePaths.isPublic(location)) return RoutePaths.signedOutHome;
  if (signedIn && RoutePaths.isPublic(location)) return RoutePaths.signedInHome;
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
    ...authRoutes,
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AdaptiveScaffold(navigationShell: shell, destinations: _tabs, title: 'Parent Portal'),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.home, builder: (_, _) => const HomeScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.academics, builder: (_, s) => AcademicsScreen(section: s.uri.queryParameters['section']))]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.fees, builder: (_, _) => const FeesScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.messages, builder: (_, _) => const MessagesScreen())]),
        StatefulShellBranch(routes: [GoRoute(path: RoutePaths.more, builder: (_, _) => const MoreScreen())]),
      ],
    ),
    // Module routes. Fixed paths are listed before their ":id" siblings inside each module file.
    ...homeRoutes,
    ...academicsRoutes,
    ...messagesRoutes,
    ...profileRoutes,
    ...studentRoutes,
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
