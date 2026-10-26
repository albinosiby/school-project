import '../../../utils/exceptions/app_exception.dart';
import '../../teachers/repositories/teachers_repository_interface.dart';
import '../models/ptm_models.dart';
import 'ptm_repository_interface.dart';

/// Meeting slots are not published by the school system yet: the teachers are listed (to message them) and
/// booking explains how to request a meeting.
class FirebasePtmRepository implements IPtmRepository {
  FirebasePtmRepository(this._teachers);
  final ITeachersRepository _teachers;

  static AppException get _unavailable =>
      AppException(message: 'Booking meetings in the app is not available yet. Message the teacher to fix a time.');

  @override
  Stream<PtmData> watchPtm(String childId) => _teachers
      .watchTeachers(childId)
      .map((t) => PtmData(meetings: const [], teachers: [t.classTeacher, ...t.faculty], slots: const []));

  @override
  Future<Meeting> book({required String childId, required String teacherId, required String slotId, required MeetingMode mode, required String agenda}) async =>
      throw _unavailable;

  @override
  Future<Meeting> reschedule({required String childId, required String meetingId, required String slotId}) async => throw _unavailable;

  @override
  Future<void> cancel({required String childId, required String meetingId}) async => throw _unavailable;

  @override
  Future<void> recordJoin({required String childId, required String meetingId}) async {}
}
