import 'package:go_router/go_router.dart';
import '../../../core/settings/application_setting.dart';
import '../../../core/walk_through/walkthrough_1.dart';
import '../../../modules/home/screens/faculty_id_screen.dart';
import '../../../modules/home/screens/notification_detail_screen.dart';
import '../../../modules/home/screens/notifications_screen.dart';
import '../../../modules/home/screens/profile_screen.dart';
import '../../../modules/home/screens/substitution_screen.dart';
import '../../../modules/home/screens/weekly_grid_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the home module. Paths come from RoutePaths.
/// (Home and Timetable tabs are shell branches in routes_config.dart.)
final List<RouteBase> homeRoutes = [
  GoRoute(path: RoutePaths.onboarding, builder: (_, _) => const OnboardingScreen()),
  GoRoute(path: RoutePaths.notifications, builder: (_, _) => const NotificationsScreen()),
  GoRoute(path: RoutePaths.notificationDetail, builder: (_, s) => NotificationDetailScreen(id: s.pathParameters['id']!)),
  GoRoute(path: RoutePaths.profile, builder: (_, _) => const ProfileScreen()),
  GoRoute(path: RoutePaths.settings, builder: (_, _) => const ApplicationSettingsScreen()),
  GoRoute(path: RoutePaths.facultyId, builder: (_, _) => const FacultyIdScreen()),
  GoRoute(path: RoutePaths.weeklyGrid, builder: (_, _) => const WeeklyGridScreen()),
  GoRoute(path: RoutePaths.substitutionDetail, builder: (_, s) => SubstitutionScreen(id: s.pathParameters['id']!)),
];
