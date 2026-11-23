import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/attendance/repositories/firebase_attendance_repository.dart';
import 'package:parent_app/modules/fees/repositories/firebase_fee_repository.dart';
import 'package:parent_app/modules/timetable/repositories/firebase_timetable_repository.dart';
import 'package:parent_app/utils/services/firebase/parent_session.dart';
import 'package:school_sync/school_sync.dart';

class _Mobile extends MobileSchoolClient {
  _Mobile(FirebaseAuth auth, FirebaseFirestore db) : super(auth: auth, db: db);
  @override
  Future<Map<String, dynamic>> call(String name, [Map<String, dynamic> input = const {}]) async => {
    'complete': true,
    'academicYear': '2026-27',
    'gross': 11200,
    'concessions': 1000,
    'net': 10200,
    'paid': 3000,
    'payable': 7200,
    'invoiceIds': ['i1'],
    'charges': [
      {'name': 'Tuition', 'amount': 10000, 'quantity': 1, 'frequency': 'Annual', 'mandatory': true},
      {'name': 'Transport', 'amount': 1200, 'quantity': 1, 'frequency': 'Annual', 'mandatory': true},
    ],
  };
}

void main() {
  late FakeFirebaseFirestore db;
  late ParentSession session;
  const root = 'schools/s1';
  setUp(() async {
    db = FakeFirebaseFirestore();
    final auth = MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: 'p1'));
    session = ParentSession(db: db, auth: auth, mobileClient: _Mobile(auth, db));
    await db.doc('users/p1').set({
      'role': 'parent',
      'schoolId': 's1',
      'studentIds': ['kid'],
      'grns': ['G1'],
    });
    await db.doc('$root/students/kid').set({'classId': 'cls_UKGA', 'grn': 'G1', 'admissionDate': '2026-04-02'});
    await db.doc('$root/classes/cls_UKGA').set({'room': '101'});
    await db.doc('$root/classes/cls_UKGB').set({'room': '202'});
    await db.doc('$root/school/mobile').set({
      'academicYear': '2026-27',
      'minimumAttendance': 82.5,
      'academicRange': {'start': '2026-04-01', 'end': '2027-03-31'},
      'workingDays': [1],
      'utcOffsetMinutes': 330,
      'schedule': [
        {'label': 'Period 1', 'start': '09:00', 'end': '09:40'},
        {'label': 'Lunch', 'start': '09:40', 'end': '10:10', 'isBreak': true},
        {'label': 'Period 2', 'start': '10:10', 'end': '10:50'},
      ],
    });
    await session.load();
  });
  test('academic attendance excludes old years and pre-admission days and preserves the school threshold', () async {
    await db.doc('$root/par_attendance/m1').set({
      'studentId': 'kid',
      'days': {'2025-04-01': 'P', '2026-04-01': 'P', '2026-04-02': 'P', '2026-04-03': 'L', '2026-04-04': 'E', '2026-04-05': 'A'},
    });
    final value = await FirebaseAttendanceRepository(session).watchAttendance('kid').first;
    expect(value.records.length, 4);
    expect(value.overall.percentage, 50);
    expect(value.minimumAttendance, 82.5);
    expect(value.academicYear, '2026-27');
  });
  test('no attendance is a real 0% summary', () async {
    final value = await FirebaseAttendanceRepository(session).watchAttendance('kid').first;
    expect(value.overall.percentage, 0);
    expect(value.overall.workingDays, 0);
  });
  test('sign-out clears the shared session cache and student snapshots', () async {
    var cleared = 0;
    final scoped = ParentSession(db: db, auth: session.auth, onClear: () => cleared++);
    await scoped.load();
    scoped.remember('kid', {'classId': 'cls_UKGA'});
    scoped.clear();
    expect(cleared, 1);
    expect(scoped.cached('kid'), isNull);
    expect(scoped.schoolId, '');
  });
  test('changing school cannot reuse a previous school student cache', () async {
    var cleared = 0;
    final scoped = ParentSession(db: db, auth: session.auth, onClear: () => cleared++);
    await scoped.load();
    scoped.remember('kid', {'classId': 'cls_UKGA'});
    await db.doc('users/p1').update({'schoolId': 's2'});
    await scoped.load();
    expect(cleared, 1);
    expect(scoped.cached('kid'), isNull);
    expect(scoped.schoolId, 's2');
  });
  test('timetable uses breaks, unassigned slots and class room; switching division drops the old listener', () async {
    await db.doc('$root/ops_periods/a').set({
      'classId': 'cls_UKGA',
      'day': 'Mon',
      'period': 1,
      'subject': 'English',
      'teacher': 'Teacher A',
    });
    await db.doc('$root/ops_periods/b').set({'classId': 'cls_UKGB', 'day': 'Mon', 'period': 2, 'subject': 'Maths', 'teacher': 'Teacher B'});
    final iterator = StreamIterator(FirebaseTimetableRepository(session).watchWeek('kid'));
    expect(await iterator.moveNext(), true);
    expect(iterator.current.periods.map((p) => p.subject), ['English', 'Lunch', 'Unassigned']);
    expect(iterator.current.periods.first.room, '101');
    expect(iterator.current.periods[1].isBreak, true);
    await db.doc('$root/students/kid').update({'classId': 'cls_UKGB'});
    do {
      expect(await iterator.moveNext(), true);
    } while (iterator.current.periods.first.room != '202');
    expect(iterator.current.periods.last.subject, 'Maths');
    expect(iterator.current.periods.last.startMinute, 610);
    await iterator.cancel();
  });
  test('full-year balance includes uninvoiced charges; invoice concessions do not inflate its balance', () async {
    await db.doc('$root/fee_invoices/i1').set({
      'studentId': 'kid',
      'grn': 'G1',
      'issued': '2026-04-02',
      'due': '2026-05-01',
      'amount': 9000,
      'paid': 3000,
      'lines': [
        {'label': 'Tuition', 'amount': 10000},
      ],
    });
    final fees = await FirebaseFeeRepository(session).watchFees('kid').first;
    expect(fees.total, 10200);
    expect(fees.paid, 3000);
    expect(fees.balance, 7200);
    expect(fees.invoices.single.amount, 9000);
    expect(fees.invoices.single.balance, 6000);
  });
}
