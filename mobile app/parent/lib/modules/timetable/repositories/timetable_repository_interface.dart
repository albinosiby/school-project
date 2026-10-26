import '../models/timetable_models.dart';

abstract class ITimetableRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<TimetableWeek> watchWeek(String childId);
}
