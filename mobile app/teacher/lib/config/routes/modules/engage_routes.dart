import 'package:go_router/go_router.dart';
import '../../../modules/engage/screens/exam_candidate_screen.dart';
import '../../../modules/engage/screens/exam_duties_screen.dart';
import '../../../modules/engage/screens/exam_duty_detail_screen.dart';
import '../../../modules/engage/screens/exam_hall_screen.dart';
import '../../../modules/engage/screens/leave_management_screen.dart';
import '../../../modules/engage/screens/live_class_join_screen.dart';
import '../../../modules/engage/screens/live_class_schedule_screen.dart';
import '../../../modules/engage/screens/live_classes_screen.dart';
import '../../../modules/engage/screens/meeting_join_screen.dart';
import '../../../modules/engage/screens/meeting_room_screen.dart';
import '../../../modules/engage/screens/meeting_schedule_screen.dart';
import '../../../modules/engage/screens/meetings_screen.dart';
import '../../../modules/engage/screens/message_detail_screen.dart';
import '../../../modules/engage/screens/message_drafts_screen.dart';
import '../../../modules/engage/screens/message_new_screen.dart';
import '../../../modules/engage/screens/messages_screen.dart';
import '../../../modules/engage/screens/student_leaves_screen.dart';
import '../routes.dart';

/// Full-screen (pushed) routes of the engage module. Paths come from RoutePaths.
/// Fixed paths (schedule, new, drafts, hall/...) are registered before their `:id` siblings.
final List<RouteBase> engageRoutes = [
  // Live classes
  GoRoute(path: RoutePaths.liveClasses, builder: (_, _) => const LiveClassesScreen()),
  GoRoute(path: RoutePaths.liveClassSchedule, builder: (_, st) => LiveClassScheduleScreen(editId: st.uri.queryParameters['id'])),
  GoRoute(path: RoutePaths.liveClassJoinPath, builder: (_, st) => LiveClassJoinScreen(id: st.pathParameters['id']!)),

  // Leave management
  GoRoute(path: RoutePaths.leaveManagement, builder: (_, _) => const LeaveManagementScreen()),
  GoRoute(path: RoutePaths.studentLeaves, builder: (_, _) => const StudentLeavesScreen()),

  // Parent-teacher meetings
  GoRoute(path: RoutePaths.meetings, builder: (_, _) => const MeetingsScreen()),
  GoRoute(path: RoutePaths.meetingSchedule, builder: (_, st) => MeetingScheduleScreen(editId: st.uri.queryParameters['id'])),
  GoRoute(path: RoutePaths.meetingJoinPath, builder: (_, st) => MeetingJoinScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.meetingRoomPath, builder: (_, st) => MeetingRoomScreen(id: st.pathParameters['id']!)),

  // Exam duties
  GoRoute(path: RoutePaths.examDuties, builder: (_, _) => const ExamDutiesScreen()),
  GoRoute(path: RoutePaths.examHallPath, builder: (_, st) => ExamHallScreen(id: st.pathParameters['id']!)),
  GoRoute(path: RoutePaths.examCandidatePath, builder: (_, st) => ExamCandidateScreen(dutyId: st.pathParameters['id']!, candidateId: st.pathParameters['cid']!)),
  GoRoute(path: RoutePaths.examDutyDetail, builder: (_, st) => ExamDutyDetailScreen(id: st.pathParameters['id']!)),

  // Messages
  GoRoute(path: RoutePaths.messages, builder: (_, _) => const MessagesScreen()),
  GoRoute(path: RoutePaths.messageNew, builder: (_, st) => MessageNewScreen(draftId: st.uri.queryParameters['draft'], to: st.uri.queryParameters['to'])),
  GoRoute(path: RoutePaths.messageDrafts, builder: (_, _) => const MessageDraftsScreen()),
  GoRoute(path: RoutePaths.messageDetail, builder: (_, st) => MessageDetailScreen(id: st.pathParameters['id']!)),
];
