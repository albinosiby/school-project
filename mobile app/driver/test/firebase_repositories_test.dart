import 'package:driver_app/modules/attendance/models/attendance_models.dart';
import 'package:driver_app/modules/attendance/repositories/firebase_attendance_repository.dart';
import 'package:driver_app/modules/auth/repositories/firebase_auth_repository.dart';
import 'package:driver_app/modules/crew/models/crew_models.dart';
import 'package:driver_app/modules/crew/repositories/firebase_crew_repository.dart';
import 'package:driver_app/modules/crew_attendance/repositories/firebase_crew_attendance_repository.dart';
import 'package:driver_app/modules/leave/repositories/firebase_leave_repository.dart';
import 'package:driver_app/modules/notices/repositories/firebase_notice_repository.dart';
import 'package:driver_app/modules/students/repositories/firebase_student_repository.dart';
import 'package:driver_app/modules/trips/models/trip_models.dart';
import 'package:driver_app/modules/trips/repositories/firebase_trip_repository.dart';
import 'package:driver_app/utils/exceptions/app_exception.dart';
import 'package:driver_app/utils/services/firebase/crew_session.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' show FirebaseAuthException;
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter_test/flutter_test.dart';

/// The fake's snapshot stream can replay a snapshot queued before the last write; the real SDK applies local writes to
/// the cache first. Take the value the stream settles on.
Future<T> latest<T>(Stream<T> s) async {
  late T v;
  final sub = s.listen((e) => v = e);
  await Future<void>.delayed(const Duration(milliseconds: 50));
  await sub.cancel();
  return v;
}

/// Firestore repositories against an in-memory Firestore laid out as in data contract section 14.
void main() {
  late FakeFirebaseFirestore db;
  late CrewSession session;
  const sid = 'sch_1', uid = 'uid_d1', crewId = 'crw_001', busId = 'bus_01';
  final today = isoDay(DateTime.now());

  Future<void> put(String col, String id, Map<String, dynamic> data) => db.doc('schools/$sid/$col/$id').set(data);

  setUp(() async {
    db = FakeFirebaseFirestore();
    session = CrewSession(db: db, auth: MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid, email: 'rajesh@school.edu')));
    await db.doc('users/$uid').set({'schoolId': sid, 'role': 'driver', 'crewId': crewId, 'email': 'rajesh@school.edu', 'name': 'Rajesh Kumar'});
    await put('school', 'school', {'name': 'Greenfield (test)'});
    await put('tr_crew', crewId, {'name': 'Rajesh Kumar', 'role': 'driver', 'empId': 'TR-1004', 'phone': '+91 1', 'email': 'rajesh@school.edu', 'busId': busId, 'bus': 'Bus 14'});
    await put('tr_crew', 'crw_002', {'name': 'Sunita Devi', 'role': 'attendant', 'busId': busId, 'bus': 'Bus 14', 'phone': '+91 2'});
    await put('tr_crew', 'crw_003', {'name': 'Other', 'role': 'driver', 'busId': 'bus_02'});
    await put('tr_buses', busId, {
      'number': '14', 'regNo': 'DL-01-AB-4092', 'capacity': 42, 'routeName': 'Route 4B', 'driverId': crewId, 'driver': 'Rajesh Kumar',
      'attendantId': 'crw_002', 'attendant': 'Sunita Devi', 'stops': [{'id': 'stp_01', 'name': 'Sector 14 Market', 'pickupTime': '06:45', 'dropTime': '15:40'}], 'studentCount': 2,
    });
    await put('students', 'stu_101', {'name': 'Aarav Sharma', 'grade': '10', 'section': 'B', 'roll': 18, 'guardian': 'Mr. Rahul Sharma', 'phone': '+91 98100 00001', 'busId': busId, 'busStopId': 'stp_01', 'busStop': 'Sector 14 Market'});
    await put('students', 'stu_102', {'name': 'Ananya Patel', 'grade': '10', 'section': 'B', 'roll': 2, 'guardian': 'Mrs. Nisha Patel', 'phone': '+91 98100 00002', 'busId': busId, 'busStopId': 'stp_01', 'busStop': 'Sector 14 Market'});
    await put('students', 'stu_201', {'name': 'Other Bus', 'busId': 'bus_02'});
    await put('tr_settings', 'policy', {'checkInBy': '06:30'});
    await session.load();
  });

  test('session: a login that is not a crew login is refused', () async {
    await db.doc('users/$uid').update({'role': 'teacher'});
    expect(session.load(), throwsA(isA<AppException>()));
    await db.doc('users/$uid').update({'role': 'driver', 'crewId': ''});
    expect(session.load(), throwsA(isA<AppException>()));
  });

  test('session: loads crew id, role and bus', () {
    expect(session.crewId, crewId);
    expect(session.role, CrewRole.driver);
    expect(session.busId, busId);
  });

  test('sign-in error codes become readable messages', () {
    expect(FirebaseAuthRepository.authMessage(FirebaseAuthException(code: 'invalid-credential')), 'Incorrect email or password.');
    expect(FirebaseAuthRepository.authMessage(FirebaseAuthException(code: 'network-request-failed')), contains('internet'));
  });

  test('crew context: me, my bus, my partner and the school', () async {
    final ctx = await FirebaseCrewRepository(session).watchContext().first;
    expect(ctx.me.name, 'Rajesh Kumar');
    expect(ctx.bus!.label, 'Bus 14');
    expect(ctx.bus!.stops.single.name, 'Sector 14 Market');
    expect(ctx.partner!.id, 'crw_002');
    expect(ctx.schoolName, 'Greenfield (test)');
  });

  test('crew context without a bus has no bus and no partner', () async {
    await db.doc('schools/$sid/tr_crew/$crewId').update({'busId': ''});
    final ctx = await FirebaseCrewRepository(session).watchContext().first;
    expect(ctx.bus, isNull);
    expect(ctx.partner, isNull);
  });

  test('profile update writes only the allowed fields with the stamp', () async {
    await FirebaseCrewRepository(session).updateProfile(phone: '+91 9', emergencyName: 'Meena');
    final d = (await db.doc('schools/$sid/tr_crew/$crewId').get()).data()!;
    expect(d['phone'], '+91 9');
    expect(d['emergencyName'], 'Meena');
    expect(d['updatedBy'], uid);
    expect(d['busId'], busId);
  });

  test('roster: only my bus, ordered by stop then roll', () async {
    final r = await FirebaseStudentRepository(session).watchRoster(busId).first;
    expect(r.map((s) => s.id), ['stu_102', 'stu_101']);
    expect(r.first.phone, '+91 98100 00002');
    expect(r.first.classLabel, 'Class 10-B');
  });

  test('trips: watching today creates both scheduled trips once, with the roster count and crew', () async {
    final repo = FirebaseTripRepository(session);
    final trips = await repo.watchDay(busId, today).first;
    expect(trips.map((t) => t.kind), [TripKind.pickup, TripKind.drop]);
    expect(trips.first.id, '${today}_${busId}_pickup');
    expect(trips.first.total, 2);
    expect(trips.first.driver, 'Rajesh Kumar');
    expect(trips.first.attendant, 'Sunita Devi');
    expect(trips.first.status, TripStatus.scheduled);
    final again = await repo.watchDay(busId, today).first;
    expect(again.length, 2);
    expect((await db.collection('schools/$sid/tr_trips').get()).docs.length, 2);
  });

  test('trips: checklist, start, end; ending a pickup marks boarded pupils dropped', () async {
    final repo = FirebaseTripRepository(session);
    final att = FirebaseAttendanceRepository(session);
    var trip = (await repo.watchDay(busId, today).first).first;
    expect(trip.needsChecklist, isTrue);
    await repo.saveChecklist(trip, const Checklist(brakes: true, lights: true, tyres: true, fuel: true, firstAid: true, cleanliness: true));
    trip = (await repo.watchDay(busId, today).first).first;
    expect(trip.checklist.complete, isTrue);
    await repo.startTrip(trip, odometer: 48210);
    trip = (await repo.watchDay(busId, today).first).first;
    expect(trip.isActive, isTrue);
    expect(trip.startedBy, crewId);
    expect(trip.odometerStart, 48210);

    await att.mark(trip, 'stu_101', MarkStatus.boarded, stopId: 'stp_01');
    await att.mark(trip, 'stu_102', MarkStatus.absent, stopId: 'stp_01');
    final a = await latest(att.watch(trip));
    expect(a.of('stu_101')!.status, MarkStatus.boarded);
    expect(a.of('stu_101')!.by, crewId);
    expect(a.of('stu_101')!.byName, 'Rajesh Kumar');
    expect(a.of('stu_102')!.status, MarkStatus.absent);
    trip = (await repo.watchDay(busId, today).first).first;
    expect((trip.boarded, trip.absent, trip.dropped), (1, 1, 0));
    final raw = (await db.doc('schools/$sid/tr_attendance/${trip.id}').get()).data()!;
    expect(raw['busId'], busId);
    expect(raw['kind'], 'pickup');
    expect(raw['total'], 2);
    expect(raw['boarded'], 1);

    await repo.endTrip(trip, odometer: 48230, note: 'Fog on the highway');
    trip = (await repo.watchDay(busId, today).first).first;
    expect(trip.isCompleted, isTrue);
    expect(trip.endedBy, crewId);
    expect(trip.note, 'Fog on the highway');
    expect((trip.boarded, trip.absent, trip.dropped), (0, 1, 1));
    final after = await latest(att.watch(trip));
    expect(after.of('stu_101')!.status, MarkStatus.dropped);
    expect(after.of('stu_102')!.status, MarkStatus.absent);
  });

  test('attendance: clearing a mark removes the key and recounts', () async {
    final repo = FirebaseTripRepository(session);
    final att = FirebaseAttendanceRepository(session);
    final trip = (await repo.watchDay(busId, today).first).first;
    await att.mark(trip, 'stu_101', MarkStatus.boarded);
    await att.mark(trip, 'stu_101', null);
    final a = await latest(att.watch(trip));
    expect(a.of('stu_101'), isNull);
    expect((await repo.watchDay(busId, today).first).first.boarded, 0);
  });

  test('attendance history of the bus, newest first', () async {
    await put('tr_attendance', '2026-10-01_${busId}_pickup', {'tripId': '2026-10-01_${busId}_pickup', 'busId': busId, 'date': '2026-10-01', 'kind': 'pickup', 'total': 1, 'marks': {'stu_101': {'status': 'dropped', 'at': '2026-10-01T01:30:00.000Z', 'by': 'crw_002'}}});
    await put('tr_attendance', '2026-10-02_${busId}_pickup', {'tripId': '2026-10-02_${busId}_pickup', 'busId': busId, 'date': '2026-10-02', 'kind': 'pickup', 'total': 1, 'marks': {'stu_101': {'status': 'absent', 'at': '2026-10-02T01:30:00.000Z', 'by': 'crw_002'}}});
    final h = await FirebaseAttendanceRepository(session).watchBusHistory(busId).first;
    expect(h.map((a) => a.date), ['2026-10-02', '2026-10-01']);
    expect(h.first.of('stu_101')!.status, MarkStatus.absent);
  });

  test('trip history excludes today\'s open trips and orders newest first', () async {
    await put('tr_trips', '2026-10-01_${busId}_pickup', {'busId': busId, 'date': '2026-10-01', 'kind': 'pickup', 'status': 'completed'});
    await put('tr_trips', '2026-10-02_${busId}_drop', {'busId': busId, 'date': '2026-10-02', 'kind': 'drop', 'status': 'completed'});
    final repo = FirebaseTripRepository(session);
    await repo.watchDay(busId, today).first; // creates today's scheduled trips
    final h = await repo.watchHistory(busId).first;
    expect(h.map((t) => t.date), ['2026-10-02', '2026-10-01']);
  });

  test('crew attendance: punch in (late after checkInBy), punch out, month listing', () async {
    final repo = FirebaseCrewAttendanceRepository(session);
    await repo.punchIn();
    expect(repo.punchIn(), throwsA(isA<AppException>()));
    final d = (await db.doc('schools/$sid/tr_crew_attendance/${today}_$crewId').get()).data()!;
    expect(d['crewId'], crewId);
    expect(d['role'], 'driver');
    expect(d['busId'], busId);
    expect(d['source'], 'app');
    expect(d['status'], (d['in'] as String).compareTo('06:30') > 0 ? 'Late' : 'Present');
    await repo.punchOut();
    final a = await repo.watch(today.substring(0, 7)).first;
    expect(a.today!.punchedOut, isTrue);
    expect(a.month.single.date, today);
    expect(a.checkInBy, '06:30');
  });

  test('crew attendance: punch out before punch in is refused', () {
    expect(FirebaseCrewAttendanceRepository(session).punchOut(), throwsA(isA<AppException>()));
  });

  test('leave: apply, list own only, withdraw', () async {
    await put('tr_crew_leaves', 'lv_other', {'crewId': 'crw_002', 'type': 'Sick', 'from': '2026-10-01', 'to': '2026-10-01', 'status': 'Pending', 'appliedAt': '2026-09-30T00:00:00.000Z'});
    final repo = FirebaseLeaveRepository(session);
    final l = await repo.apply(type: 'Casual', from: '2026-11-03', to: '2026-11-04', reason: 'Family');
    final d = (await db.doc('schools/$sid/tr_crew_leaves/${l.id}').get()).data()!;
    expect(d['crewId'], crewId);
    expect(d['status'], 'Pending');
    expect(d['days'], 2);
    expect(d['name'], 'Rajesh Kumar');
    expect(d['busId'], busId);
    final mine = await repo.watch().first;
    expect(mine.map((e) => e.id), [l.id]);
    expect(repo.apply(type: 'Casual', from: '2026-11-05', to: '2026-11-04', reason: 'x'), throwsA(isA<AppException>()));
    await repo.withdraw(l.id);
    expect(await repo.watch().first, isEmpty);
  });

  test('notices: published and addressed to the crew, pinned first', () async {
    await put('com_notices', 'n1', {'title': 'Draft', 'status': 'Draft', 'audience': 'Transport Routes'});
    await put('com_notices', 'n2', {'title': 'Teachers', 'status': 'Published', 'audience': 'Teachers only'});
    await put('com_notices', 'n3', {'title': 'Fog', 'status': 'Published', 'audience': 'Transport Routes', 'sentAt': '2026-10-30T00:00:00.000Z'});
    await put('com_notices', 'n4', {'title': 'Holiday', 'status': 'Published', 'audience': 'All School', 'sentAt': '2026-10-31T00:00:00.000Z', 'pinned': true});
    final n = await FirebaseNoticeRepository(session).watch().first;
    expect(n.map((e) => e.title), ['Holiday', 'Fog']);
  });
}
