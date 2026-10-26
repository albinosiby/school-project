import 'package:go_router/go_router.dart';
import '../../../modules/attendance/screens/apply_leave_screen.dart';
import '../../../modules/attendance/screens/attendance_overview_screen.dart';
import '../../../modules/attendance/screens/circular_detail_screen.dart';
import '../../../modules/attendance/screens/circulars_screen.dart';
import '../../../modules/attendance/screens/leave_slip_screen.dart';
import '../../../modules/attendance/screens/mark_attendance_screen.dart';
import '../../../modules/attendance/screens/marks_entry_screen.dart';
import '../../../modules/attendance/screens/marks_screen.dart';
import '../../../modules/attendance/screens/medical_slips_screen.dart';
import '../../../modules/attendance/screens/self_log_screen.dart';
import '../../../modules/attendance/screens/trends_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the attendance module. Paths come from RoutePaths.
final List<RouteBase> attendanceRoutes = [
  GoRoute(
    path: RoutePaths.attendanceMark,
    builder: (_, st) => MarkAttendanceScreen(classId: st.uri.queryParameters['class'], period: int.tryParse(st.uri.queryParameters['period'] ?? '')),
  ),
  GoRoute(path: RoutePaths.attendanceTrends, builder: (_, _) => const TrendsScreen()),
  GoRoute(path: RoutePaths.attendanceSelfLog, builder: (_, _) => const SelfLogScreen()),
  GoRoute(path: RoutePaths.medicalSlips, builder: (_, st) => MedicalSlipsScreen(studentId: st.uri.queryParameters['student'])),
  GoRoute(path: RoutePaths.attendanceHistory, builder: (_, _) => const AttendanceOverviewScreen()),
  GoRoute(path: RoutePaths.leaveSlipDetail, builder: (_, st) => LeaveSlipScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.marks, builder: (_, st) => MarksScreen(classId: st.uri.queryParameters['class'])),
  GoRoute(
    path: RoutePaths.marksEnter,
    builder: (_, st) => MarksEntryScreen(examId: st.uri.queryParameters['exam'], studentId: st.uri.queryParameters['student']),
  ),
  GoRoute(
    path: RoutePaths.marksEdit,
    builder: (_, st) => MarksEntryScreen(edit: true, examId: st.uri.queryParameters['exam'], studentId: st.uri.queryParameters['student']),
  ),
  GoRoute(path: RoutePaths.leaveApply, builder: (_, _) => const ApplyLeaveScreen()),
  GoRoute(path: RoutePaths.circulars, builder: (_, _) => const CircularsScreen()),
  GoRoute(path: RoutePaths.circularDetail, builder: (_, st) => CircularDetailScreen(id: st.pathParameters['id']!)),
];
