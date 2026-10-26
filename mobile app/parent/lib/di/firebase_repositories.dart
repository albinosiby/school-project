import 'package:get_it/get_it.dart';
import '../modules/attendance/repositories/attendance_repository_interface.dart';
import '../modules/attendance/repositories/firebase_attendance_repository.dart';
import '../modules/auth/repositories/auth_repository_interface.dart';
import '../modules/auth/repositories/firebase_auth_repository.dart';
import '../modules/family/repositories/family_repository_interface.dart';
import '../modules/family/repositories/firebase_family_repository.dart';
import '../modules/fees/repositories/fee_repository_interface.dart';
import '../modules/fees/repositories/firebase_fee_repository.dart';
import '../modules/homework/repositories/firebase_homework_repository.dart';
import '../modules/homework/repositories/homework_repository_interface.dart';
import '../modules/leave/repositories/firebase_leave_repository.dart';
import '../modules/leave/repositories/leave_repository_interface.dart';
import '../modules/live_classes/repositories/firebase_live_class_repository.dart';
import '../modules/live_classes/repositories/live_class_repository_interface.dart';
import '../modules/marks/repositories/firebase_marks_repository.dart';
import '../modules/marks/repositories/marks_repository_interface.dart';
import '../modules/messages/repositories/firebase_message_repository.dart';
import '../modules/messages/repositories/message_repository_interface.dart';
import '../modules/notices/repositories/firebase_notice_repository.dart';
import '../modules/notices/repositories/notice_repository_interface.dart';
import '../modules/timetable/repositories/firebase_timetable_repository.dart';
import '../modules/timetable/repositories/timetable_repository_interface.dart';
import '../utils/services/firebase/parent_session.dart';
import '../utils/services/firebase/push_service.dart';

/// BACKEND=firebase: Firestore repositories (data contract §13). Same interfaces as the mock ones, so BLoCs and
/// screens do not change.
void registerFirebaseRepositories(GetIt getIt) {
  final session = ParentSession();
  getIt
    ..registerSingleton<ParentSession>(session)
    ..registerSingleton<ParentPushService>(ParentPushService())
    ..registerSingleton<IAuthRepository>(FirebaseAuthRepository(session, getIt()))
    ..registerSingleton<IFamilyRepository>(FirebaseFamilyRepository(session))
    ..registerSingleton<IAttendanceRepository>(FirebaseAttendanceRepository(session))
    ..registerSingleton<IHomeworkRepository>(FirebaseHomeworkRepository(session))
    ..registerSingleton<IMarksRepository>(FirebaseMarksRepository(session))
    ..registerSingleton<ITimetableRepository>(FirebaseTimetableRepository(session))
    ..registerSingleton<INoticeRepository>(FirebaseNoticeRepository(session))
    ..registerSingleton<ILiveClassRepository>(FirebaseLiveClassRepository(session))
    ..registerSingleton<ILeaveRepository>(FirebaseLeaveRepository(session))
    ..registerSingleton<IMessageRepository>(FirebaseMessageRepository(session))
    ..registerSingleton<IFeeRepository>(FirebaseFeeRepository(session));
}
