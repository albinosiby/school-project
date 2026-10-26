import 'package:firebase_auth/firebase_auth.dart' show FirebaseAuthException;
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/attendance/models/attendance_models.dart';
import 'package:parent_app/modules/attendance/repositories/firebase_attendance_repository.dart';
import 'package:parent_app/modules/auth/repositories/firebase_auth_repository.dart';
import 'package:parent_app/modules/family/repositories/firebase_family_repository.dart';
import 'package:parent_app/modules/fees/repositories/firebase_fee_repository.dart';
import 'package:parent_app/modules/homework/repositories/firebase_homework_repository.dart';
import 'package:parent_app/modules/leave/models/leave_models.dart';
import 'package:parent_app/modules/leave/repositories/firebase_leave_repository.dart';
import 'package:parent_app/modules/live_classes/repositories/firebase_live_class_repository.dart';
import 'package:parent_app/modules/marks/repositories/firebase_marks_repository.dart';
import 'package:parent_app/modules/messages/repositories/firebase_message_repository.dart';
import 'package:parent_app/modules/notices/repositories/firebase_notice_repository.dart';
import 'package:parent_app/modules/timetable/repositories/firebase_timetable_repository.dart';
import 'package:parent_app/utils/exceptions/app_exception.dart';
import 'package:parent_app/utils/services/firebase/parent_session.dart';
import 'package:parent_app/utils/services/firebase/push_service.dart';

/// Firestore repositories against an in-memory Firestore laid out as in data contract §13.
void main() {
  late FakeFirebaseFirestore db;
  late ParentSession session;
  const sid = 'sch_1', uid = 'par_1', child = 'stu_101';

  CollectionReferenceHelper school(String c) => CollectionReferenceHelper(db, sid, c);

  setUp(() async {
    db = FakeFirebaseFirestore();
    final auth = MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid, email: 'rahul@example.com'));
    session = ParentSession(db: db, auth: auth);
    await db.doc('users/$uid').set({
      'schoolId': sid, 'role': 'parent', 'email': 'rahul@example.com', 'name': 'Mr. Rahul Sharma',
      'studentIds': [child], 'classIds': ['cls_10B'], 'grns': ['GIS-9200'],
    });
    await school('students').set(child, {
      'name': 'Aarav Sharma', 'grade': '10', 'section': 'B', 'classId': 'cls_10B', 'roll': 1, 'grn': 'GIS-9200',
      'guardian': 'Mr. Rahul Sharma', 'relation': 'Father', 'phone': '+91 98100 00001', 'guardianUids': [uid, 'par_2'],
    });
    await school('students').set('stu_102', {'name': 'Other Child', 'classId': 'cls_10B', 'grn': 'GIS-9201'});
    await school('classes').set('cls_10B', {'grade': '10', 'section': 'B', 'classTeacherId': 'stf_025', 'classTeacher': 'Mrs. Anita Sharma'});
    await session.load();
  });

  test('a login that is not a parent login is refused', () async {
    await db.doc('users/$uid').update({'role': 'teacher'});
    expect(session.load(), throwsA(isA<AppException>()));
  });

  test('sign-in error codes become readable messages', () {
    expect(FirebaseAuthRepository.authMessage(FirebaseAuthException(code: 'invalid-credential')), 'Incorrect email or password.');
  });

  test('family: guardian from users, children with their class teacher', () async {
    final f = await FirebaseFamilyRepository(session).watchFamily().first;
    expect(f.guardian.name, 'Mr. Rahul Sharma');
    expect(f.guardian.relation, 'Father');
    expect(f.children.single.name, 'Aarav Sharma');
    expect(f.children.single.classTeacher, 'Mrs. Anita Sharma');
    expect(f.children.single.admissionNo, 'GIS-9200');
  });

  test('attendance: month docs become day records', () async {
    await school('par_attendance').set('${child}_2026-10', {
      'studentId': child, 'month': '2026-10', 'days': {'2026-10-26': 'A', '2026-10-27': 'P', '2026-10-24': 'L', '2026-10-23': 'E'},
    });
    final a = await FirebaseAttendanceRepository(session).watchAttendance(child).first;
    expect(a.records.length, 4);
    expect(a.on(DateTime(2026, 10, 26))!.status, AttendanceStatus.absent);
    expect(a.on(DateTime(2026, 10, 23))!.status, AttendanceStatus.leave);
    expect(a.overall.present, 1);
  });

  test('homework: graded submission shows score and remark', () async {
    await school('par_homework').set('${child}_hw_1', {
      'studentId': child, 'homeworkId': 'hw_1', 'title': 'Quadratics', 'subject': 'Mathematics', 'teacher': 'Mrs. Anita Sharma',
      'assigned': '2026-10-20', 'due': '2026-10-25', 'maxMarks': 20, 'submission': {'status': 'graded', 'marks': 18, 'feedback': 'Neat work'},
    });
    final h = (await FirebaseHomeworkRepository(session).watchHomework(child).first).single;
    expect(h.reviewed, isTrue);
    expect(h.submitted, isTrue);
    expect(h.score, '18/20');
    expect(h.remark, 'Neat work');
  });

  test('marks: published papers grouped per exam cycle', () async {
    for (final (s, o) in [('Mathematics', 88), ('Science', 76)]) {
      await school('par_results').set('${child}_p_$s', {
        'studentId': child, 'paperId': 'p_$s', 'cycleId': 'cyc_1', 'exam': 'Term 1 Mid-Term', 'subject': s, 'date': '2026-09-20', 'obtained': o, 'max': 100,
      });
    }
    final r = (await FirebaseMarksRepository(session).watchExams(child).first).single;
    expect(r.name, 'Term 1 Mid-Term');
    expect(r.subjects.length, 2);
    expect(r.obtained, 164);
    expect(r.max, 200);
  });

  test('timetable: class periods get bell times', () async {
    await school('ops_periods').add({'classId': 'cls_10B', 'day': 'Mon', 'period': 3, 'subject': 'Mathematics', 'teacher': 'Mrs. Anita Sharma', 'room': '204'});
    await school('ops_periods').add({'classId': 'cls_9A', 'day': 'Mon', 'period': 1, 'subject': 'Other class', 'teacher': '', 'room': ''});
    final w = await FirebaseTimetableRepository(session).watchWeek(child).first;
    expect(w.periods.single.subject, 'Mathematics');
    expect(w.periods.single.weekday, 1);
    expect(w.periods.single.startMinute, 10 * 60 + 15);
  });

  test('fees: invoices matched on the child grn', () async {
    await school('fee_invoices').set('inv_1', {
      'grn': 'GIS-9200', 'term': 'Term 2', 'issued': '2026-10-01', 'due': '2026-10-15', 'amount': 30000, 'paid': 10000,
      'lines': [{'label': 'Tuition', 'amount': 25000}, {'label': 'Lab', 'amount': 5000}],
    });
    await school('fee_invoices').set('inv_2', {'grn': 'GIS-9201', 'amount': 1, 'issued': '2026-10-01', 'due': '2026-10-15'});
    final f = await FirebaseFeeRepository(session).watchFees(child).first;
    expect(f.invoices.single.title, 'Term 2 Fees');
    expect(f.balance, 20000);
  });

  test('notices: parent-visible, filtered by grade, acknowledgement recorded', () async {
    await school('com_notices').set('n1', {'title': 'Fog advisory', 'body': 'Late start', 'parentVisible': true, 'urgent': true, 'sentAt': '2026-10-26T09:00:00', 'author': 'Principal'});
    await school('com_notices').set('n2', {'title': 'Grade 6 trip', 'parentVisible': true, 'grades': ['6'], 'sentAt': '2026-10-25T09:00:00'});
    await school('com_notices').set('n3', {'title': 'Staff only', 'parentVisible': false});
    final repo = FirebaseNoticeRepository(session);
    final list = await repo.watchNotices(child).first;
    expect(list.map((n) => n.id), ['n1']);
    expect(list.single.needsAction, isTrue);
    await repo.acknowledge('n1');
    expect((await db.doc('schools/$sid/com_notices/n1/acks/$uid').get()).exists, isTrue);
    expect((await repo.watchNotices(child).first).single.acknowledged, isTrue);
  });

  test('live classes: class sessions only, drafts hidden, join recorded', () async {
    await school('live_classes').set('lc1', {'classId': 'cls_10B', 'title': 'Algebra revision', 'subject': 'Mathematics', 'date': '2026-10-28', 'time': '16:00', 'mins': 40, 'link': 'https://meet.google.com/abc-defg-hij', 'status': 'scheduled', 'teacher': 'Mrs. Anita Sharma'});
    await school('live_classes').set('lc2', {'classId': 'cls_10B', 'title': 'Draft', 'date': '2026-10-29', 'time': '16:00', 'link': 'https://meet.google.com/x', 'status': 'Draft'});
    final repo = FirebaseLiveClassRepository(session);
    final list = await repo.watchLiveClasses(child).first;
    expect(list.single.id, 'lc1');
    expect(list.single.start, DateTime(2026, 10, 28, 16));
    await repo.recordJoin('lc1');
    expect((await db.doc('schools/$sid/live_classes/lc1/joins/$uid').get()).data()!['role'], 'parent');
  });

  test('leave: request carries what the teacher app shows, decision comes back', () async {
    final repo = FirebaseLeaveRepository(session);
    final r = await repo.apply(childId: child, from: DateTime(2026, 10, 28), to: DateTime(2026, 10, 29), reason: 'Fever, doctor advised rest');
    final doc = (await db.doc('schools/$sid/student_leaves/${r.id}').get()).data()!;
    expect(doc['status'], 'Pending');
    expect(doc['parentUid'], uid);
    expect(doc['classId'], 'cls_10B');
    expect(doc['cat'], 'medical');
    expect(doc['daysLabel'], '2 Days');
    expect(doc['by'], 'Mr. Rahul Sharma (Father)');
    await db.doc('schools/$sid/student_leaves/${r.id}').update({'status': 'Approved', 'decisionNote': 'Get well soon'});
    final back = (await repo.watchLeaves(child).first).single;
    expect(back.status, LeaveStatus.approved);
    expect(back.reviewerNote, 'Get well soon');
  });

  test('messages: start a thread with every guardian, send, read resets own counter only', () async {
    final repo = FirebaseMessageRepository(session);
    final id = await repo.startThread(childId: child, teacherId: 'stf_025', teacher: 'Mrs. Anita Sharma', role: 'Class Teacher');
    expect(id, 'thr_${child}_stf_025');
    final t = (await db.doc('schools/$sid/msg_threads/$id').get()).data()!;
    expect(t['parentUids'], containsAll([uid, 'par_2']));
    await repo.send(id, ' Will Aarav need a calculator? ');
    final m = (await db.collection('schools/$sid/msg_messages').get()).docs.single.data();
    expect(m['from'], 'parent');
    expect(m['text'], 'Will Aarav need a calculator?');
    expect(m['teacherId'], 'stf_025');
    await db.doc('schools/$sid/msg_threads/$id').update({'unreadParent': 2, 'unreadTeacher': 1});
    final threads = await repo.watchThreads(child).first;
    expect(threads.single.unread, 2);
    await repo.watchMessages(id).first;
    await Future<void>.delayed(Duration.zero);
    final after = (await db.doc('schools/$sid/msg_threads/$id').get()).data()!;
    expect(after['unreadParent'], 0);
    expect(after['unreadTeacher'], 1);
  });

  test('stored UTC times are shown in local time; writes are UTC', () {
    final t = parseTime('2026-10-26T22:54:17.000Z')!;
    expect(t.isUtc, isFalse);
    expect(t, DateTime.utc(2026, 10, 26, 22, 54, 17).toLocal());
    expect(nowUtc(), endsWith('Z'));
  });

  test('notices: the open list updates as soon as the parent acknowledges', () async {
    await school('com_notices').set('n1', {'title': 'Fog advisory', 'parentVisible': true, 'urgent': true, 'sentAt': '2026-10-26T09:00:00Z'});
    final repo = FirebaseNoticeRepository(session);
    final seen = <bool>[];
    final sub = repo.watchNotices(child).listen((l) => seen.add(l.single.acknowledged));
    await Future<void>.delayed(const Duration(milliseconds: 200));
    await repo.acknowledge('n1');
    await Future<void>.delayed(const Duration(milliseconds: 200));
    await sub.cancel();
    expect(seen.first, isFalse);
    expect(seen.last, isTrue);
  });

  test('push service works without Firebase (tests, web)', () async {
    final push = ParentPushService();
    await push.start(uid);
    await push.stop();
  });
}

/// Writes into `schools/{sid}/{collection}`.
class CollectionReferenceHelper {
  CollectionReferenceHelper(this.db, this.sid, this.name);
  final FakeFirebaseFirestore db;
  final String sid, name;
  Future<void> set(String id, Map<String, dynamic> data) => db.doc('schools/$sid/$name/$id').set(data);
  Future<void> add(Map<String, dynamic> data) => db.collection('schools/$sid/$name').add(data);
}
