import 'package:go_router/go_router.dart';
import '../../../modules/classes/screens/behaviour_screen.dart';
import '../../../modules/classes/screens/documents_screen.dart';
import '../../../modules/classes/screens/new_homework_screen.dart';
import '../../../modules/classes/screens/new_log_screen.dart';
import '../../../modules/classes/screens/resources_screen.dart';
import '../../../modules/classes/screens/student_profile_screen.dart';
import '../../../modules/classes/screens/students_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the classes module. Paths come from RoutePaths.
/// Query params: behaviour/new-log `classId`, `studentId`; resources `classId`; students `classId`, `q`; homework/new `classId`.
final List<RouteBase> classesRoutes = [
  GoRoute(path: RoutePaths.behaviour, builder: (_, st) => BehaviourScreen(classId: st.uri.queryParameters['classId'], studentId: st.uri.queryParameters['studentId'])),
  GoRoute(path: RoutePaths.behaviourNew, builder: (_, st) => NewLogScreen(classId: st.uri.queryParameters['classId'], studentId: st.uri.queryParameters['studentId'])),
  GoRoute(path: RoutePaths.resources, builder: (_, st) => ResourcesScreen(classId: st.uri.queryParameters['classId'])),
  GoRoute(path: RoutePaths.students, builder: (_, st) => StudentsScreen(classId: st.uri.queryParameters['classId'], query: st.uri.queryParameters['q'])),
  GoRoute(path: RoutePaths.studentDetail, builder: (_, st) => StudentProfileScreen(id: st.pathParameters['id']!, tab: ProfileTab.overview)),
  GoRoute(path: RoutePaths.studentAcademicsPath, builder: (_, st) => StudentProfileScreen(id: st.pathParameters['id']!, tab: ProfileTab.academics)),
  GoRoute(path: RoutePaths.studentAttendancePath, builder: (_, st) => StudentProfileScreen(id: st.pathParameters['id']!, tab: ProfileTab.attendance)),
  GoRoute(path: RoutePaths.studentDocumentsPath, builder: (_, st) => DocumentsScreen(studentId: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.homeworkNew, builder: (_, st) => NewHomeworkScreen(classId: st.uri.queryParameters['classId'])),
];
