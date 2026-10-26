import 'package:get_it/get_it.dart';
import '../modules/auth/repositories/firebase_registration_repository.dart';
import '../modules/auth/repositories/registration_repository_interface.dart';
import '../modules/behaviour/repositories/behaviour_repository_interface.dart';
import '../modules/behaviour/repositories/firebase_behaviour_repository.dart';
import '../modules/notifications/repositories/firebase_notification_repository.dart';
import '../modules/notifications/repositories/notification_repository_interface.dart';
import '../modules/profile/repositories/firebase_profile_repository.dart';
import '../modules/profile/repositories/profile_repository_interface.dart';
import '../modules/ptm/repositories/firebase_ptm_repository.dart';
import '../modules/ptm/repositories/ptm_repository_interface.dart';
import '../modules/student/repositories/firebase_student_repository.dart';
import '../modules/student/repositories/student_repository_interface.dart';
import '../modules/teachers/repositories/firebase_teachers_repository.dart';
import '../modules/teachers/repositories/teachers_repository_interface.dart';
import '../modules/transport/repositories/firebase_transport_repository.dart';
import '../modules/transport/repositories/transport_repository_interface.dart';
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
import '../utils/services/local_storage_service.dart';

/// BACKEND=firebase: Firestore repositories (data contract §13). Same interfaces as the mock ones, so BLoCs and
/// screens do not change.
void registerFirebaseRepositories(GetIt getIt) {
  // the feature modules registered the mock repositories first; swap each for its Firestore version
  void replace<T extends Object>(T impl) {
    if (getIt.isRegistered<T>()) getIt.unregister<T>();
    getIt.registerSingleton<T>(impl);
  }

  final session = ParentSession();
  replace<ParentSession>(session);
  replace<ParentPushService>(ParentPushService());
  replace<IAuthRepository>(FirebaseAuthRepository(session, getIt()));
  replace<IFamilyRepository>(FirebaseFamilyRepository(session));
  replace<IAttendanceRepository>(FirebaseAttendanceRepository(session));
  replace<IHomeworkRepository>(FirebaseHomeworkRepository(session));
  replace<IMarksRepository>(FirebaseMarksRepository(session));
  replace<ITimetableRepository>(FirebaseTimetableRepository(session));
  replace<INoticeRepository>(FirebaseNoticeRepository(session));
  replace<ILiveClassRepository>(FirebaseLiveClassRepository(session));
  replace<ILeaveRepository>(FirebaseLeaveRepository(session));
  replace<IMessageRepository>(
    FirebaseMessageRepository(session, getIt<LocalStorageService>()),
  );
  replace<IFeeRepository>(FirebaseFeeRepository(session));
  final storage = getIt<LocalStorageService>();
  replace<INotificationRepository>(
    FirebaseNotificationRepository(session, getIt(), storage),
  );
  replace<IProfileRepository>(
    FirebaseProfileRepository(session, getIt(), storage),
  );
  replace<IStudentRepository>(FirebaseStudentRepository(session));
  replace<ITeachersRepository>(FirebaseTeachersRepository(session));
  replace<IPtmRepository>(FirebasePtmRepository(getIt()));
  replace<ITransportRepository>(FirebaseTransportRepository());
  replace<IBehaviourRepository>(FirebaseBehaviourRepository());
  replace<IRegistrationRepository>(FirebaseRegistrationRepository());
  // settings stay on the device (LocalSettingsRepository)
}
