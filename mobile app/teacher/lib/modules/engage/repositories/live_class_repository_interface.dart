import '../models/live_class_models.dart';

/// Live (virtual) class sessions.
abstract class ILiveClassRepository {
  Future<List<LiveSession>> getAll();
  Future<LiveSession?> get(String id);

  /// Creates the session when [session].id is empty (assigning a room), otherwise updates it
  /// (room, attendance, tag and co-host of the stored session are kept).
  Future<LiveSession> save(LiveSession session);
  Future<void> setStatus(String id, LiveStatus status, {int? joined});
  Future<void> delete(String id);

  /// The signed-in user tapped Join (writes `live_classes/{id}/joins/{uid}` on Firebase, no-op locally).
  Future<void> recordJoin(String id);
  Stream<void> watch();
}
