import 'package:get_it/get_it.dart';
import '../modules/attendance/repositories/attendance_repository_interface.dart';
import '../modules/attendance/repositories/firebase_attendance_repository.dart';
import '../modules/auth/repositories/auth_repository_interface.dart';
import '../modules/auth/repositories/firebase_auth_repository.dart';
import '../modules/crew/repositories/crew_repository_interface.dart';
import '../modules/crew/repositories/firebase_crew_repository.dart';
import '../modules/crew_attendance/repositories/crew_attendance_repository_interface.dart';
import '../modules/crew_attendance/repositories/firebase_crew_attendance_repository.dart';
import '../modules/leave/repositories/firebase_leave_repository.dart';
import '../modules/leave/repositories/leave_repository_interface.dart';
import '../modules/notices/repositories/firebase_notice_repository.dart';
import '../modules/notices/repositories/notice_repository_interface.dart';
import '../modules/students/repositories/firebase_student_repository.dart';
import '../modules/students/repositories/student_repository_interface.dart';
import '../modules/trips/repositories/firebase_trip_repository.dart';
import '../modules/trips/repositories/trip_repository_interface.dart';
import '../utils/services/firebase/crew_session.dart';

/// BACKEND=firebase: Firestore repositories (data contract section 14). Same interfaces as the mock ones.
void registerFirebaseRepositories(GetIt getIt, {CrewSession? session}) {
  final s = session ?? CrewSession();
  getIt.registerSingleton<CrewSession>(s);
  getIt.registerLazySingleton<IAuthRepository>(() => FirebaseAuthRepository(s));
  getIt.registerLazySingleton<ICrewRepository>(() => FirebaseCrewRepository(s));
  getIt.registerLazySingleton<IStudentRepository>(() => FirebaseStudentRepository(s));
  getIt.registerLazySingleton<ITripRepository>(() => FirebaseTripRepository(s));
  getIt.registerLazySingleton<IAttendanceRepository>(() => FirebaseAttendanceRepository(s));
  getIt.registerLazySingleton<ICrewAttendanceRepository>(() => FirebaseCrewAttendanceRepository(s));
  getIt.registerLazySingleton<ILeaveRepository>(() => FirebaseLeaveRepository(s));
  getIt.registerLazySingleton<INoticeRepository>(() => FirebaseNoticeRepository(s));
}
