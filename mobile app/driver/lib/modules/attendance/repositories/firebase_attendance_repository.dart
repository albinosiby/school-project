import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/firebase/crew_session.dart';
import '../../trips/models/trip_models.dart';
import '../../trips/repositories/firebase_trip_repository.dart';
import '../models/attendance_models.dart';
import 'attendance_repository_interface.dart';

/// `tr_attendance/{date}_{busId}_{kind}` (contract 14.4). A mark is a transaction (read, set the key, recount), so the
/// driver and the attendant may mark different pupils at the same moment without losing each other's marks.
class FirebaseAttendanceRepository implements IAttendanceRepository {
  FirebaseAttendanceRepository(this._session);
  final CrewSession _session;

  CollectionReference<Json> get _col => _session.col('tr_attendance');

  @override
  Stream<TripAttendance> watch(Trip trip) => _session.whenReady(() => _col.doc(trip.id).snapshots().map((s) {
        final d = s.data();
        return d == null ? TripAttendance.empty(trip) : TripAttendance.fromJson(d, id: s.id);
      }));

  @override
  Future<void> mark(Trip trip, String studentId, MarkStatus? status, {String? stopId}) async {
    final ref = _col.doc(trip.id);
    final tripRef = _session.col('tr_trips').doc(trip.id);
    await _session.db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final current = snap.data() == null ? TripAttendance.empty(trip) : TripAttendance.fromJson(snap.data()!, id: snap.id);
      final next = current.withMark(
        studentId,
        status == null ? null : Mark(status: status, at: DateTime.now(), by: _session.crewId, byName: _session.me?.name ?? '', stopId: stopId),
      );
      final counts = countMarks(next.marks);
      final stamp = {'updatedAt': nowUtc(), 'updatedBy': _session.uid};
      tx.set(ref, {...next.toJson(), 'total': trip.total, ...stamp});
      tx.update(tripRef, {'boarded': counts.$1, 'dropped': counts.$2, 'absent': counts.$3, ...stamp});
    });
  }

  @override
  Stream<List<TripAttendance>> watchBusHistory(String busId) {
    if (busId.isEmpty) return Stream.value(const []);
    return _session.whenReady(() => _col.where('busId', isEqualTo: busId).orderBy('date', descending: true).limit(80).snapshots().map(
          (q) => [for (final d in q.docs) TripAttendance.fromJson(d.data(), id: d.id)],
        ));
  }
}
