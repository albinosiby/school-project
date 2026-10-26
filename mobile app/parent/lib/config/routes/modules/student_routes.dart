import 'package:go_router/go_router.dart';
import '../../../modules/ptm/screens/ptm_screen.dart';
import '../../../modules/student/screens/certificates_screen.dart';
import '../../../modules/student/screens/student_profile_screen.dart';
import '../../../modules/teachers/screens/teachers_screen.dart';
import '../routes.dart';

/// Pushed routes of the student profile, certificates, PTM and teachers modules.
final List<RouteBase> studentRoutes = [
  GoRoute(
    path: RoutePaths.studentProfile,
    builder: (_, _) => const StudentProfileScreen(),
  ),
  GoRoute(
    path: RoutePaths.certificates,
    builder: (_, _) => const CertificatesScreen(),
  ),
  GoRoute(
    path: RoutePaths.ptm,
    builder: (_, s) => PtmScreen(teacherId: s.uri.queryParameters['teacher']),
  ),
  GoRoute(path: RoutePaths.teachers, builder: (_, _) => const TeachersScreen()),
];
