import '../models/ptm_models.dart';

abstract class IPtmRepository {
  /// Cache-first: meetings, bookable teachers and their slots. Writes push fresh data through this stream.
  Stream<PtmData> watchPtm(String childId);

  Future<Meeting> book({
    required String childId,
    required String teacherId,
    required String slotId,
    required MeetingMode mode,
    required String agenda,
  });

  Future<Meeting> reschedule({
    required String childId,
    required String meetingId,
    required String slotId,
  });

  Future<void> cancel({required String childId, required String meetingId});

  /// Records the join click (`meetings/{id}/joins/{uid}` later).
  Future<void> recordJoin({required String childId, required String meetingId});
}
