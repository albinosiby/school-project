import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../di/injection.dart';
import '../../modules/auth/cubit/session_cubit.dart';
import '../../modules/auth/models/auth_models.dart';
import '../../modules/auth/screens/auth_screen.dart';
import '../../modules/crew/screens/crew_screen.dart';
import '../../modules/transport/screens/transport_screen.dart';
import '../../modules/operations/screens/operations_screen.dart';
import '../../modules/account/screens/account_screen.dart';
import '../../modules/attendant/screens/attendant_screen.dart';
import '../../modules/learning/screens/learning_screen.dart';
import '../../design_system/layouts/adaptive_scaffold.dart';
import 'routes.dart';
import 'view_catalog.dart';

const uiReview = bool.fromEnvironment('UI_REVIEW');
Widget featureScreen(String id) => switch (viewCatalog[id]?.feature) {
  'auth' => AuthScreen(id: id),
  'crew' => CrewScreen(id: id),
  'transport' => TransportScreen(id: id),
  'operations' => OperationsScreen(id: id),
  'account' => AccountScreen(id: id),
  'attendant' => AttendantScreen(id: id),
  'learning' => LearningScreen(id: id),
  _ => const Center(child: Text('Screen unavailable')),
};
GoRouter createRouter({String? initialLocation}) => GoRouter(
  initialLocation: initialLocation ?? AppRoutes.path('7566'),
  redirect: (context, state) {
    if (uiReview) return null;
    final id = state.uri.path.startsWith('/screen/')
        ? state.uri.path.split('/').last
        : null;
    final session = getIt<SessionCubit>().state;
    if (!session.authenticated &&
        !(id != null && AppRoutes.public.contains(id))) {
      return AppRoutes.path('7566');
    }
    if (session.authenticated &&
        state.uri.path.startsWith('/assistant/') &&
        session.role != CrewRole.assistant) {
      return '/driver/home';
    }
    if (session.authenticated &&
        state.uri.path.startsWith('/driver/') &&
        session.role != CrewRole.driver) {
      return '/assistant/home';
    }
    return null;
  },
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('This screen is unavailable.'),
          FilledButton(
            onPressed: () => context.go(AppRoutes.path('7566')),
            child: const Text('Go to welcome'),
          ),
        ],
      ),
    ),
  ),
  routes: [
    for (final assistant in [false, true])
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) =>
            AdaptiveScaffold(shell: shell, assistant: assistant),
        branches: [
          for (final id
              in (assistant
                  ? ['4', '4772', '1720', '4193']
                  : ['5271', '5638', '6416', '6922']))
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.path(id),
                  builder: (context, state) => featureScreen(id),
                ),
              ],
            ),
        ],
      ),
    for (final id in viewCatalog.keys.where(
      (id) => !AppRoutes.primary.contains(id),
    ))
      GoRoute(
        path: AppRoutes.path(id),
        pageBuilder: (context, state) => MaterialPage(
          key: state.pageKey,
          fullscreenDialog: id == '8359' || id == '4589',
          child: Scaffold(
            resizeToAvoidBottomInset: true,
            body: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: featureScreen(id),
              ),
            ),
          ),
        ),
      ),
  ],
);
