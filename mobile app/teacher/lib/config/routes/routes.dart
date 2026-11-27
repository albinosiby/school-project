/// Every route path in the app. Use these constants (and the helpers for
/// parameterised paths) instead of string literals.
class RoutePaths {
  RoutePaths._();

  // Tabs (shell branches)
  static const String home = '/home';
  static const String timetable = '/timetable';
  static const String classes = '/classes';
  /// The class teacher's class management page (opened from the Classes tab) and one student's progress in it.
  static const String classManagePath = '/class-manage/:id';
  static String classManage(String id) => '/class-manage/$id';
  static const String classStudentPath = '/class-manage/:id/student/:sid';
  static String classStudent(String id, String sid) => '/class-manage/$id/student/$sid';
  static const String tasks = '/tasks';
  static const String more = '/more';

  // Auth
  static const String login = '/login';
  static const String forgotPassword = '/forgot-password';

  // Core
  static const String onboarding = '/onboarding';
  static const String settings = '/profile/settings';

  // Home module
  static const String notifications = '/notifications';
  static const String notificationDetail = '/notifications/:id';
  static String notification(String id) => '/notifications/$id';
  static const String profile = '/profile';
  static const String facultyId = '/profile/faculty-id';
  static const String weeklyGrid = '/timetable/weekly';
  static const String substitutionDetail = '/timetable/substitution/:id';
  static String substitution(String id) => '/timetable/substitution/$id';

  // Classes module
  static const String behaviour = '/classes/behaviour';
  static const String behaviourNew = '/classes/behaviour/new';
  static const String resources = '/classes/resources';
  static const String students = '/students';
  static const String studentDetail = '/students/:id';
  static String student(String id) => '/students/$id';
  static const String studentAcademicsPath = '/students/:id/academics';
  static String studentAcademics(String id) => '/students/$id/academics';
  static const String studentAttendancePath = '/students/:id/attendance';
  static String studentAttendance(String id) => '/students/$id/attendance';
  static const String studentDocumentsPath = '/students/:id/documents';
  static String studentDocuments(String id) => '/students/$id/documents';
  static const String homeworkNew = '/homework/new';

  // Tasks module
  static const String taskAdd = '/tasks/add';
  static const String duties = '/duties';
  static const String dutyDetail = '/duties/:id';
  static String duty(String id) => '/duties/$id';
  static const String homeworkDetail = '/homework/:id';
  static String homework(String id) => '/homework/$id';
  static const String homeworkGradedPath = '/homework/:id/graded';
  static String homeworkGraded(String id) => '/homework/$id/graded';
  static const String homeworkProgressPath = '/homework/:id/progress';
  static String homeworkProgress(String id) => '/homework/$id/progress';

  // Attendance module
  static const String attendanceMark = '/attendance/mark';
  /// The marking screen opened on one class and period (both optional): the live period from Home and the
  /// timetable, a class from the attention list, or nothing for the quick action (the screen then picks the first).
  /// [date] (yyyy-MM-dd) opens a past day's register from the timetable.
  static String markAttendance({String? classId, int? period, String? date}) {
    final query = {
      if (classId != null && classId.isNotEmpty) 'class': classId,
      if (period != null) 'period': '$period',
      if (date != null && date.isNotEmpty) 'date': date,
    };
    return query.isEmpty ? attendanceMark : Uri(path: attendanceMark, queryParameters: query).toString();
  }
  static const String attendanceTrends = '/attendance/trends';
  static const String attendanceSelfLog = '/attendance/self-log';
  static const String medicalSlips = '/attendance/medical-slips';
  static const String attendanceHistory = '/attendance/history';
  static const String leaveSlipDetail = '/attendance/leave-slip/:id';
  static String leaveSlip(String id) => '/attendance/leave-slip/$id';
  static const String marks = '/marks';
  static const String marksEnter = '/marks/enter';
  static const String marksEdit = '/marks/edit';
  static const String leaveApply = '/leave/apply';
  static const String circulars = '/circulars';
  static const String circularDetail = '/circulars/:id';
  static String circular(String id) => '/circulars/$id';

  // Lessons module
  static const String lessonPlans = '/lesson-plans';
  static const String lessonPlanDetail = '/lesson-plans/:id';
  static String lessonPlan(String id) => '/lesson-plans/$id';
  static const String lessonPlanEditPath = '/lesson-plans/:id/edit';
  static String lessonPlanEdit(String id) => '/lesson-plans/$id/edit';
  static const String tests = '/tests';
  static const String testNew = '/tests/new';
  static const String testEditPath = '/tests/:id/edit';
  static String testEdit(String id) => '/tests/$id/edit';
  static const String certificates = '/certificates';
  static const String certificateIssue = '/certificates/issue';
  static const String certificatePreview = '/certificates/preview';
  static const String certificateTemplates = '/certificates/templates';
  static const String certificateDetail = '/certificates/:id';
  static String certificate(String id) => '/certificates/$id';

  // Engage module
  static const String liveClasses = '/live-classes';
  static const String liveClassJoinPath = '/live-classes/join/:id';
  static String liveClassJoin(String id) => '/live-classes/join/$id';
  static const String liveClassSchedule = '/live-classes/schedule';
  static const String leaveManagement = '/leave-management';
  static const String meetings = '/meetings';
  static const String meetingSchedule = '/meetings/schedule';
  static const String meetingJoinPath = '/meetings/join/:id';
  static String meetingJoin(String id) => '/meetings/join/$id';
  static const String meetingRoomPath = '/meetings/room/:id';
  static String meetingRoom(String id) => '/meetings/room/$id';
  static const String examDuties = '/exam-duties';
  static const String examDutyDetail = '/exam-duties/:id';
  static String examDuty(String id) => '/exam-duties/$id';
  static const String examHallPath = '/exam-duties/hall/:id';
  static String examHall(String id) => '/exam-duties/hall/$id';
  static const String examCandidatePath = '/exam-duties/hall/:id/candidate/:cid';
  static String examCandidate(String hall, String cid) => '/exam-duties/hall/$hall/candidate/$cid';
  static const String messages = '/messages';
  static const String messageNew = '/messages/new';
  static const String messageDetail = '/messages/:id';
  static String message(String id) => '/messages/$id';
}
