import 'package:go_router/go_router.dart';
import '../../../modules/homework/screens/homework_detail_screen.dart';
import '../../../modules/marks/screens/marks_detail_screen.dart';
import '../routes.dart';

/// Pushed routes of the academics (attendance, homework, marks, timetable) and fees modules.
final List<RouteBase> academicsRoutes = [
  GoRoute(path: RoutePaths.homeworkDetail, builder: (_, s) => HomeworkDetailScreen(id: s.pathParameters['id']!)),
  GoRoute(path: RoutePaths.marksDetail, builder: (_, s) => MarksDetailScreen(id: s.pathParameters['id']!)),
];
