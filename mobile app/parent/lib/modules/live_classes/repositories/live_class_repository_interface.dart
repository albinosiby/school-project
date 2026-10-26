import '../models/live_class_models.dart';

abstract class ILiveClassRepository {
  Stream<List<LiveClass>> watchLiveClasses(String childId);

  /// Records that the guardian opened the Meet link (live_classes/{id}/joins/{uid} later). Not proof of presence.
  Future<void> recordJoin(String classId);
}
