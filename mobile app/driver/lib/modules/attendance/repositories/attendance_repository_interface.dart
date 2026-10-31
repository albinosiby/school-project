import '../../trips/models/trip_models.dart';
import '../models/attendance_models.dart';

abstract class IAttendanceRepository {
  /// Cache-first: the marks of [trip] (an empty record when nothing is marked yet).
  Stream<TripAttendance> watch(Trip trip);

  /// Sets (or, with null, clears) one student's mark. Both crew members may mark at once (merge write).
  Future<void> mark(Trip trip, String studentId, MarkStatus? status, {String? stopId});

  /// Day history of one student on this bus, newest first (used by the student sheet).
  Stream<List<TripAttendance>> watchBusHistory(String busId);
}
