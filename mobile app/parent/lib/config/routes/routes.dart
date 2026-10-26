/// Path constants. Tab roots live in the StatefulShellRoute; detail screens are pushed above the dock.
class RoutePaths {
  RoutePaths._();

  // Auth
  static const login = '/login';
  static const forgotPassword = '/login/forgot';

  // Tabs
  static const home = '/home';
  static const attendance = '/attendance';
  static const learn = '/learn'; // ?section=homework|marks|timetable
  static const inbox = '/inbox'; // ?section=notices|messages
  static const more = '/more';

  // Details
  static const homeworkDetail = '/learn/homework/:id';
  static const marksDetail = '/learn/marks/:id';
  static const chat = '/inbox/chat/:id';
  static const liveClasses = '/more/live';
  static const leave = '/more/leave';
  static const leaveApply = '/more/leave/apply';
  static const fees = '/more/fees';
  static const profile = '/more/profile';

  static String homework(String id) => '/learn/homework/$id';
  static String marks(String id) => '/learn/marks/$id';
  static String chatWith(String id, {String? teacher, String? role}) => Uri(
    path: '/inbox/chat/$id',
    queryParameters: {'teacher': ?teacher, 'role': ?role},
  ).toString();
  static String learnSection(String s) => '/learn?section=$s';
  static String inboxSection(String s) => '/inbox?section=$s';

  static bool isPublic(String location) =>
      location == login || location == forgotPassword;
}
