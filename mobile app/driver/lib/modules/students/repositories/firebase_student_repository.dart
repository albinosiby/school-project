import '../../../utils/services/firebase/crew_session.dart';
import '../models/student_models.dart';
import 'student_repository_interface.dart';

/// `students` where `busId == myBusId` (contract 14.2): the only student query the rules allow a crew member.
class FirebaseStudentRepository implements IStudentRepository {
  FirebaseStudentRepository(this._session);
  final CrewSession _session;

  @override
  Stream<List<BusStudent>> watchRoster(String busId) {
    if (busId.isEmpty) return Stream.value(const []);
    return _session.whenReady(() => _session.col('students').where('busId', isEqualTo: busId).snapshots().map((q) {
          final rows = [for (final d in q.docs) if (d.data()['deleted'] != true) BusStudent.fromJson(d.data(), id: d.id)];
          rows.sort(rosterOrder);
          return rows;
        }));
  }
}

/// Stop order (by stop id, which the admin web numbers in route order), then roll, then name.
int rosterOrder(BusStudent a, BusStudent b) {
  final s = a.busStopId.compareTo(b.busStopId);
  if (s != 0) return s;
  final r = a.roll.compareTo(b.roll);
  return r != 0 ? r : a.name.compareTo(b.name);
}
