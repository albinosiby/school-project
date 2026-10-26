import '../../../utils/services/firebase/parent_session.dart';
import '../models/attendance_models.dart';
import 'attendance_repository_interface.dart';

/// `par_attendance/{studentId}_{YYYY-MM}` month docs written by a Cloud Function from the teachers' records (§13.2).
class FirebaseAttendanceRepository implements IAttendanceRepository {
  FirebaseAttendanceRepository(this._session);
  final ParentSession _session;

  static const _status = {
    'P': AttendanceStatus.present,
    'A': AttendanceStatus.absent,
    'L': AttendanceStatus.late,
    'E': AttendanceStatus.leave,
    'H': AttendanceStatus.halfDay,
  };

  @override
  Stream<AttendanceData> watchAttendance(String childId) =>
      _session.col('par_attendance').where('studentId', isEqualTo: childId).snapshots().map((q) {
        final records = <AttendanceRecord>[];
        for (final doc in q.docs) {
          final days = doc.data()['days'];
          if (days is! Map) continue;
          days.forEach((day, code) {
            final date = parseDay(day);
            final status = _status['$code'];
            if (date != null && status != null) records.add(AttendanceRecord(date: date, status: status));
          });
        }
        records.sort((a, b) => a.date.compareTo(b.date));
        return AttendanceData(records);
      });
}
