/// Every route path of the app. Tabs are shell branches; the rest are pushed on top.
class RoutePaths {
  RoutePaths._();

  static const welcome = '/welcome';
  static const login = '/login';
  static const forgot = '/login/forgot';

  static const home = '/home';
  static const trips = '/trips';
  static const students = '/students';
  static const profile = '/profile';

  static const tripHistory = '/trips/history';
  static String trip(String id) => '/trips/$id';
  static String checklist(String id) => '/trips/$id/checklist';
  static const stops = '/students/stops';
  static const attendance = '/profile/attendance';
  static const leave = '/profile/leave';
  static const applyLeave = '/profile/leave/apply';
  static const notices = '/notices';
  static String notice(String id) => '/notices/$id';
  static const editProfile = '/profile/edit';

  static const signedOutHome = welcome;
  static const signedInHome = home;

  static bool isPublic(String location) => location == welcome || location.startsWith(login);
}
