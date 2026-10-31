import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/firebase/crew_session.dart';
import '../../attendance/models/attendance_models.dart';
import '../../crew/models/crew_models.dart';
import '../models/trip_models.dart';
import 'trip_repository_interface.dart';

/// `tr_trips/{date}_{busId}_{kind}` (contract 14.3).
class FirebaseTripRepository implements ITripRepository {
  FirebaseTripRepository(this._session);
  final CrewSession _session;

  CollectionReference<Json> get _trips => _session.col('tr_trips');

  @override
  Stream<List<Trip>> watchDay(String busId, String date) {
    if (busId.isEmpty) return Stream.value(const []);
    return _session.whenReady(() => Stream.fromFuture(_ensureDay(busId, date)).asyncExpand((_) =>
        _trips.where('busId', isEqualTo: busId).where('date', isEqualTo: date).snapshots().map((q) {
          final rows = [for (final d in q.docs) Trip.fromJson(d.data(), id: d.id)];
          rows.sort((a, b) => a.kind.index.compareTo(b.kind.index));
          return rows;
        })));
  }

  /// Creates today's two `scheduled` trips when missing (first crew member of the bus to open the app).
  Future<void> _ensureDay(String busId, String date) async {
    if (date != isoDay(DateTime.now())) return;
    final existing = await _trips.where('busId', isEqualTo: busId).where('date', isEqualTo: date).get();
    if (existing.docs.length >= 2) return;
    final have = {for (final d in existing.docs) d.id};
    final busSnap = await _session.col('tr_buses').doc(busId).get();
    if (busSnap.data() == null) return;
    final bus = Bus.fromJson(busSnap.data()!, id: busId);
    final roster = await _session.col('students').where('busId', isEqualTo: busId).get();
    final total = roster.docs.where((d) => d.data()['deleted'] != true).length;
    final batch = _session.db.batch();
    for (final kind in TripKind.values) {
      final id = Trip.idFor(date, busId, kind);
      if (have.contains(id)) continue;
      final t = Trip(
        id: id, busId: busId, bus: bus.label, routeName: bus.routeName, date: date, kind: kind, total: total,
        driverId: bus.driverId ?? '', driver: bus.driver ?? '', attendantId: bus.attendantId ?? '', attendant: bus.attendant ?? '',
      );
      batch.set(_trips.doc(id), {...t.toJson(), ..._stamp()});
    }
    await batch.commit();
  }

  @override
  Stream<List<Trip>> watchHistory(String busId) {
    if (busId.isEmpty) return Stream.value(const []);
    final today = isoDay(DateTime.now());
    return _session.whenReady(() => _trips.where('busId', isEqualTo: busId).orderBy('date', descending: true).limit(80).snapshots().map((q) => [
          for (final d in q.docs)
            if ('${d.data()['date']}' != today || '${d.data()['status']}' == 'completed') Trip.fromJson(d.data(), id: d.id),
        ]..sort((a, b) {
            final c = b.date.compareTo(a.date);
            return c != 0 ? c : b.kind.index.compareTo(a.kind.index);
          })));
  }

  @override
  Future<void> saveChecklist(Trip trip, Checklist checklist) => _trips.doc(trip.id).update({
        'checklist': checklist.toJson(),
        'checklistAt': nowUtc(),
        ..._stamp(),
      });

  @override
  Future<void> startTrip(Trip trip, {int? odometer}) => _trips.doc(trip.id).update({
        'status': TripStatus.active.code,
        'startedAt': nowUtc(),
        'startedBy': _session.crewId,
        'odometerStart': ?odometer,
        ..._stamp(),
      });

  @override
  Future<void> endTrip(Trip trip, {int? odometer, String note = ''}) async {
    final attRef = _session.col('tr_attendance').doc(trip.id);
    await _session.db.runTransaction((tx) async {
      final att = await tx.get(attRef);
      final data = att.data();
      final marks = data?['marks'];
      var boarded = 0, dropped = 0, absent = 0;
      final next = <String, dynamic>{};
      if (marks is Map) {
        for (final e in marks.entries) {
          final m = Map<String, dynamic>.from(e.value as Map);
          // arriving at school ends every boarded pupil's ride (contract 14.3); the drop trip keeps them for follow-up
          if (trip.kind == TripKind.pickup && m['status'] == 'boarded') {
            m['status'] = 'dropped';
            m['at'] = nowUtc();
            m['by'] = _session.crewId;
            m['byName'] = _session.me?.name ?? '';
          }
          next['${e.key}'] = m;
          switch (m['status']) {
            case 'boarded': boarded++;
            case 'dropped': dropped++;
            case 'absent': absent++;
          }
        }
      }
      if (data != null) tx.update(attRef, {'marks': next, 'boarded': boarded, 'dropped': dropped, 'absent': absent, ..._stamp()});
      tx.update(_trips.doc(trip.id), {
        'status': TripStatus.completed.code,
        'endedAt': nowUtc(),
        'endedBy': _session.crewId,
        'boarded': boarded, 'dropped': dropped, 'absent': absent,
        'odometerEnd': ?odometer,
        if (note.isNotEmpty) 'note': note,
        ..._stamp(),
      });
    });
  }

  @override
  Future<void> setCurrentStop(Trip trip, String? stopId) => _trips.doc(trip.id).update({
        'currentStopId': stopId ?? FieldValue.delete(),
        ..._stamp(),
      });

  Map<String, dynamic> _stamp() => {'updatedAt': nowUtc(), 'updatedBy': _session.uid};
}

/// Counts of a marks map (shared with the attendance repository).
(int boarded, int dropped, int absent) countMarks(Map<String, Mark> marks) {
  var b = 0, d = 0, a = 0;
  for (final m in marks.values) {
    switch (m.status) {
      case MarkStatus.boarded: b++;
      case MarkStatus.dropped: d++;
      case MarkStatus.absent: a++;
    }
  }
  return (b, d, a);
}
