/// REST endpoints (only used when `--dart-define=BACKEND=rest`; the demo runs on mock repositories).
class ApiPath {
  ApiPath._();
  static const String baseUrl = 'https://api.example.com/v1';
  static const String login = '/auth/login';
  static const String children = '/parent/children';
  static String attendance(String childId) => '/children/$childId/attendance';
  static String homework(String childId) => '/children/$childId/homework';
  static String marks(String childId) => '/children/$childId/marks';
  static String timetable(String childId) => '/children/$childId/timetable';
  static String notices(String childId) => '/children/$childId/notices';
  static String liveClasses(String childId) =>
      '/children/$childId/live-classes';
  static String leave(String childId) => '/children/$childId/leave';
  static String messages(String childId) => '/children/$childId/threads';
  static String fees(String childId) => '/children/$childId/fees';
}
