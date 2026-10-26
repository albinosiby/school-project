import '../models/attendance_models.dart';

abstract class IAttendanceRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<AttendanceData> watchAttendance(String childId);
}
