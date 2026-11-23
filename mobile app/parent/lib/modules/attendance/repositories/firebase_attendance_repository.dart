import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:school_sync/school_sync.dart';
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
      combineLatest<Object>([
        _session.col('par_attendance').where('studentId', isEqualTo: childId).snapshots(),
        _session.watchPolicy(),
        _session.col('students').doc(childId).snapshots(),
      ]).map((all) {
        final policy = all[1] as SchoolPolicy;
        final child = (all[2] as DocumentSnapshot<Json>).data() ?? const {};
        final attendance = child['academicAttendance'];
        final admission = parseDay(child['admissionDate'] ?? (attendance is Map ? attendance['admissionDate'] : null));
        final records = <String, AttendanceRecord>{};
        for (final doc in (all[0] as QuerySnapshot<Json>).docs) {
          final days = doc.data()['days'];
          if (days is! Map) continue;
          days.forEach((day, code) {
            final date = parseDay(day), status = _status['$code'];
            if (date != null && status != null && policy.includes(date, admissionDate: admission)) {
              records['$day'] = AttendanceRecord(date: date, status: status);
            }
          });
        }
        final sorted = records.values.toList()..sort((a, b) => a.date.compareTo(b.date));
        return AttendanceData(sorted, minimumAttendance: policy.minimumAttendance, academicYear: policy.academicYear);
      });
}
