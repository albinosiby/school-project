import 'package:go_router/go_router.dart';
import '../../../modules/behaviour/screens/behaviour_screen.dart';
import '../../../modules/leave/screens/leave_apply_screen.dart';
import '../../../modules/leave/screens/leave_screen.dart';
import '../../../modules/live_classes/screens/live_classes_screen.dart';
import '../../../modules/transport/screens/track_live_screen.dart';
import '../routes.dart';

/// Pushed routes of the home, leave, live classes, transport and behaviour modules.
final List<RouteBase> homeRoutes = [
  GoRoute(
    path: RoutePaths.trackLive,
    builder: (_, _) => const TrackLiveScreen(),
  ),
  GoRoute(
    path: RoutePaths.behaviour,
    builder: (_, _) => const BehaviourScreen(),
  ),
  GoRoute(
    path: RoutePaths.liveClasses,
    builder: (_, _) => const LiveClassesScreen(),
  ),
  GoRoute(
    path: RoutePaths.leaveApply,
    builder: (_, _) => const LeaveApplyScreen(),
  ),
  GoRoute(path: RoutePaths.leave, builder: (_, _) => const LeaveScreen()),
];
