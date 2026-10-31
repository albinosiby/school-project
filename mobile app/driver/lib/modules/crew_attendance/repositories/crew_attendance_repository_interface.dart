import '../models/crew_attendance_models.dart';

abstract class ICrewAttendanceRepository {
  /// Cache-first: today's day plus the days of [month] (YYYY-MM).
  Stream<CrewAttendance> watch(String month);
  Future<void> punchIn();
  Future<void> punchOut();
}
