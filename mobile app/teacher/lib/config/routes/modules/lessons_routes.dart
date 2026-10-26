import 'package:go_router/go_router.dart';
import '../../../modules/lessons/screens/certificate_detail_screen.dart';
import '../../../modules/lessons/screens/certificate_issue_screen.dart';
import '../../../modules/lessons/screens/certificate_preview_screen.dart';
import '../../../modules/lessons/screens/certificate_templates_screen.dart';
import '../../../modules/lessons/screens/certificates_screen.dart';
import '../../../modules/lessons/screens/lesson_plan_detail_screen.dart';
import '../../../modules/lessons/screens/lesson_plan_edit_screen.dart';
import '../../../modules/lessons/screens/lesson_plans_screen.dart';
import '../../../modules/lessons/screens/my_certifications_screen.dart';
import '../../../modules/lessons/screens/online_tests_screen.dart';
import '../../../modules/lessons/screens/test_edit_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the lessons module. Paths come from RoutePaths.
/// Fixed paths (/tests/new, /certificates/mine|issue|preview|templates) are listed before their `:id` siblings.
final List<RouteBase> lessonsRoutes = [
  GoRoute(path: RoutePaths.lessonPlans, builder: (_, _) => const LessonPlansScreen()),
  GoRoute(path: RoutePaths.lessonPlanDetail, builder: (_, st) => LessonPlanDetailScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.lessonPlanEditPath, builder: (_, st) => LessonPlanEditScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.tests, builder: (_, _) => const OnlineTestsScreen()),
  GoRoute(path: RoutePaths.testNew, builder: (_, _) => const TestEditScreen(id: 'new')),
  GoRoute(path: RoutePaths.testEditPath, builder: (_, st) => TestEditScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.certificates, builder: (_, _) => const CertificatesScreen()),
  GoRoute(path: RoutePaths.certificatesMine, builder: (_, _) => const MyCertificationsScreen()),
  GoRoute(path: RoutePaths.certificateIssue, builder: (_, _) => const CertificateIssueScreen()),
  GoRoute(path: RoutePaths.certificatePreview, builder: (_, _) => const CertificatePreviewScreen()),
  GoRoute(path: RoutePaths.certificateTemplates, builder: (_, st) => CertificateTemplatesScreen(selected: st.extra as String?)),
  GoRoute(path: RoutePaths.certificateDetail, builder: (_, st) => CertificateDetailScreen(id: st.pathParameters['id']!)),
];
