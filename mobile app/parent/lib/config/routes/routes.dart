/// Path constants (Figma "Parent App"). Tab roots live in the StatefulShellRoute; everything else is pushed.
class RoutePaths {
  RoutePaths._();

  // Auth / onboarding (public) — Onboarding 1, 2, 3, 1.1
  static const welcome = '/welcome';
  static const login = '/login';
  static const loginOtp = '/login/otp';
  static const forgotPassword = '/login/forgot';
  static const register = '/register';
  // Onboarding 4 (signed in, before the tabs)
  static const selectChild = '/select-child';

  // Tabs (dock): Home, Academics, Fees, Messages, More
  static const home = '/home';
  static const academics = '/academics'; // ?section=attendance|homework|marks|timetable
  static const fees = '/fees';
  static const messages = '/messages';
  static const more = '/more';

  // Home module — 1.1 Track Live, 1.2 Behaviour, 1.2 Apply Leave
  static const trackLive = '/home/track';
  static const behaviour = '/home/behaviour';
  static const leave = '/more/leave';
  static const leaveApply = '/more/leave/apply';
  static const liveClasses = '/more/live';

  // Academics module
  static const homeworkDetail = '/academics/homework/:id';
  static const marksDetail = '/academics/marks/:id';
  static String homework(String id) => '/academics/homework/$id';
  static String marks(String id) => '/academics/marks/$id';
  static String academicsSection(String s) => '/academics?section=$s';

  // Messages module — 4 Messages (tab), 4.1 View, 4.2 New
  static const chat = '/messages/thread/:id';
  static const newMessage = '/messages/new';
  static String chatWith(String id, {String? teacher, String? role}) => Uri(
    path: '/messages/thread/$id',
    queryParameters: {'teacher': ?teacher, 'role': ?role},
  ).toString();

  /// New Message prefilled with a recipient ([to] = contact id) or reopening a draft.
  static String newMessageWith({String? to, String? draft}) => Uri(
    path: newMessage,
    queryParameters: {'to': ?to, 'draft': ?draft},
  ).toString();

  // Profile module — 6 Profile, 6.1 Edit, 6.2 Settings, 6.2.1 Privacy, 7 Notifications, 7.1 Detail
  static const profile = '/more/profile';
  static const editProfile = '/more/profile/edit';
  static const settings = '/more/settings';
  static const privacyPolicy = '/more/settings/privacy';
  static const notifications = '/notifications';
  static const notificationDetail = '/notifications/:id';
  static String notification(String id) => '/notifications/$id';

  // Student module — 5.1 Student Profile, 5.2 Certificates, 5.5 PTM, 5.6 Teachers
  static const studentProfile = '/more/student';
  static const certificates = '/more/certificates';
  static const ptm = '/more/ptm';
  static const teachers = '/more/teachers';
  /// PTM screen with the booking sheet opened for [teacherId] (Teachers list -> "Book PTM").
  static String ptmWith(String teacherId) => '$ptm?teacher=$teacherId';

  // Deprecated aliases for the pre-Figma tabs; remove once no module uses them.
  static const attendance = '/academics?section=attendance';
  static const learn = academics;
  static const inbox = messages;
  static String learnSection(String s) => academicsSection(s);
  static String inboxSection(String s) => s == 'notices' ? notifications : messages;

  /// Auth guard targets: signed-out users land on Onboarding 1 (Welcome); a guardian who has just signed in
  /// (still on a public onboarding route) goes to Onboarding 4 (Select Student Profile).
  /// `authRedirect` in routes_config.dart should return these instead of [login] / [home].
  static const signedOutHome = welcome;
  static const signedInHome = selectChild;

  static const _public = {welcome, login, loginOtp, forgotPassword, register};
  static bool isPublic(String location) => _public.contains(location);
}
