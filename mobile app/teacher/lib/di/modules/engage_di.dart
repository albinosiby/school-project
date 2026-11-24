import 'package:get_it/get_it.dart';
import '../../config/app_config.dart';
import '../../modules/engage/repositories/chat_media_repository.dart';
import '../../utils/services/firebase/firebase_storage_service.dart';
import '../../utils/services/firebase/firestore_data_store.dart';
import '../../modules/engage/bloc/exam_duties_bloc.dart';
import '../../modules/engage/bloc/hall_seating_bloc.dart';
import '../../modules/engage/bloc/leave_bloc.dart';
import '../../modules/engage/bloc/live_classes_bloc.dart';
import '../../modules/engage/bloc/meeting_room_bloc.dart';
import '../../modules/engage/bloc/meetings_bloc.dart';
import '../../modules/engage/bloc/messages_bloc.dart';
import '../../modules/engage/repositories/exam_duty_repository.dart';
import '../../modules/engage/repositories/exam_duty_repository_interface.dart';
import '../../modules/engage/repositories/leave_repository.dart';
import '../../modules/engage/repositories/leave_repository_interface.dart';
import '../../modules/engage/repositories/live_class_repository.dart';
import '../../modules/engage/repositories/live_class_repository_interface.dart';
import '../../modules/engage/repositories/meeting_repository.dart';
import '../../modules/engage/repositories/meeting_repository_interface.dart';
import '../../modules/engage/repositories/message_repository.dart';
import '../../modules/engage/repositories/message_repository_interface.dart';
import '../../modules/school/repositories/school_repository_interface.dart';
import '../../modules/engage/repositories/meet_scheduling_repository.dart';
import '../../modules/engage/repositories/meet_scheduling_repository_interface.dart';
import '../../utils/services/data_store.dart';
import '../../utils/services/google/google_workspace_service.dart';

/// Registers the engage module's repositories (interface -> implementation) and BLoCs.
void registerEngageModule(GetIt getIt) {
  // Repositories
  // Google Meet rooms + Google Calendar events on the teacher's own Google account (any backend)
  getIt.registerLazySingleton<IMeetSchedulingRepository>(() => GoogleMeetSchedulingRepository(GoogleWorkspaceService()));
  getIt.registerLazySingleton<ILiveClassRepository>(() => LocalLiveClassRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<ILeaveRepository>(() => LocalLeaveRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IMeetingRepository>(() => LocalMeetingRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IExamDutyRepository>(() => LocalExamDutyRepository(getIt<DataStore>()));
  getIt.registerLazySingleton<IMessageRepository>(() => LocalMessageRepository(getIt<DataStore>()));
  // chat uploads (Storage) and presence (Firestore) for the signed-in teacher; local backend keeps files on the device
  getIt.registerLazySingleton<IChatMediaRepository>(() {
    if (!AppConfig.isFirebase) return LocalChatMediaRepository();
    final store = getIt<DataStore>();
    return FirebaseChatMediaRepository(getIt<FirebaseStorageService>(), () {
      final ctx = store is FirestoreDataStore ? store.adapterContext : null;
      return ctx == null ? null : (schoolId: ctx.schoolId, uid: ctx.authUid);
    });
  });

  // BLoCs (one instance per screen)
  getIt.registerFactory<LiveClassesBloc>(() => LiveClassesBloc(getIt<ILiveClassRepository>(), getIt<IMeetSchedulingRepository>(), getIt<IChatMediaRepository>()));
  getIt.registerFactory<LeaveBloc>(() => LeaveBloc(getIt<ILeaveRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<MeetingsBloc>(() => MeetingsBloc(getIt<IMeetingRepository>()));
  getIt.registerFactory<MeetingRoomBloc>(() => MeetingRoomBloc(getIt<IMeetingRepository>(), getIt<ISchoolRepository>()));
  getIt.registerFactory<ExamDutiesBloc>(() => ExamDutiesBloc(getIt<IExamDutyRepository>()));
  getIt.registerFactory<HallSeatingBloc>(() => HallSeatingBloc(getIt<IExamDutyRepository>()));
  getIt.registerFactory<MessagesBloc>(() => MessagesBloc(getIt<IMessageRepository>(), getIt<IChatMediaRepository>()));
}
