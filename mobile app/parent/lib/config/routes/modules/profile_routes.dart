import 'package:go_router/go_router.dart';
import '../../../modules/notifications/screens/notification_detail_screen.dart';
import '../../../modules/notifications/screens/notifications_screen.dart';
import '../../../modules/profile/screens/edit_profile_screen.dart';
import '../../../modules/profile/screens/profile_screen.dart';
import '../../../modules/settings/screens/privacy_policy_screen.dart';
import '../../../modules/settings/screens/settings_screen.dart';
import '../routes.dart';

/// Pushed routes of the profile, settings and notifications modules.
final List<RouteBase> profileRoutes = [
  GoRoute(path: RoutePaths.profile, builder: (_, _) => const ProfileScreen()),
  GoRoute(path: RoutePaths.editProfile, builder: (_, _) => const EditProfileScreen()),
  GoRoute(path: RoutePaths.settings, builder: (_, _) => const SettingsScreen()),
  GoRoute(path: RoutePaths.privacyPolicy, builder: (_, _) => const PrivacyPolicyScreen()),
  GoRoute(path: RoutePaths.notifications, builder: (_, _) => const NotificationsScreen()),
  GoRoute(
    path: RoutePaths.notificationDetail,
    builder: (_, s) => NotificationDetailScreen(id: s.pathParameters['id']!),
  ),
];
