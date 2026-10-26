import 'package:go_router/go_router.dart';
import '../../../modules/tasks/screens/add_task_screen.dart';
import '../../../modules/tasks/screens/duties_screen.dart';
import '../../../modules/tasks/screens/duty_detail_screen.dart';
import '../../../modules/tasks/screens/homework_screen.dart';
import '../../../modules/tasks/screens/progress_log_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the tasks module. Paths come from RoutePaths.
/// The Tasks tab itself (TasksScreen) is a shell branch in routes_config.dart.
final List<RouteBase> tasksRoutes = [
  GoRoute(path: RoutePaths.taskAdd, builder: (_, st) => AddTaskScreen(editId: st.uri.queryParameters['id'])),
  GoRoute(path: RoutePaths.duties, builder: (_, _) => const DutiesScreen()),
  GoRoute(path: RoutePaths.dutyDetail, builder: (_, st) => DutyDetailScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.homeworkDetail, builder: (_, st) => HomeworkScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.homeworkGradedPath, builder: (_, st) => HomeworkScreen(id: st.pathParameters['id']!, graded: true)),
  GoRoute(path: RoutePaths.homeworkProgressPath, builder: (_, st) => ProgressLogScreen(homeworkId: st.pathParameters['id'])),
];
