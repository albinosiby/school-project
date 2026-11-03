import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' show ActionCodeSettings, FirebaseAuthException, UserCredential;
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/auth/models/auth_models.dart';
import 'package:parent_app/modules/auth/repositories/firebase_auth_repository.dart';
import 'package:parent_app/modules/auth/repositories/firebase_registration_repository.dart';
import 'package:parent_app/modules/behaviour/repositories/firebase_behaviour_repository.dart';
import 'package:parent_app/modules/family/repositories/firebase_family_repository.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/firebase_fee_repository.dart';
import 'package:parent_app/modules/leave/repositories/firebase_leave_repository.dart';
import 'package:parent_app/modules/notices/repositories/firebase_notice_repository.dart';
import 'package:parent_app/modules/notifications/models/notification_models.dart';
import 'package:parent_app/modules/notifications/repositories/firebase_notification_repository.dart';
import 'package:parent_app/modules/profile/repositories/firebase_profile_repository.dart';
import 'package:parent_app/modules/ptm/models/ptm_models.dart';
import 'package:parent_app/modules/ptm/repositories/firebase_ptm_repository.dart';
import 'package:parent_app/modules/student/models/certificate_models.dart';
import 'package:parent_app/modules/student/repositories/firebase_student_repository.dart';
import 'package:parent_app/modules/teachers/models/teacher_models.dart';
import 'package:parent_app/modules/teachers/repositories/firebase_teachers_repository.dart';
import 'package:parent_app/utils/exceptions/app_exception.dart';
import 'package:parent_app/utils/services/firebase/parent_session.dart';
import 'package:parent_app/utils/services/firebase/push_service.dart';
import 'package:parent_app/utils/services/local_storage_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'helpers/pump_app.dart';

/// The Firestore repositories not covered by firebase_repositories_test.dart, against an in-memory Firestore laid out
/// as in data contract §13.
void main() {
  late FakeFirebaseFirestore db;
  late MockFirebaseAuth auth;
  late ParentSession session;
  late LocalStorageService storage;
  const sid = 'sch_1', uid = 'par_1', child = 'stu_101';

  Future<void> put(String col, String id, Map<String, dynamic> data) => db.doc('schools/$sid/$col/$id').set(data);
  Future<Map<String, dynamic>> get(String col, String id) async => (await db.doc('schools/$sid/$col/$id').get()).data() ?? {};
  Matcher appError(String text) => throwsA(isA<AppException>().having((e) => e.message, 'message', contains(text)));

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorageService();
    await storage.init();
    db = FakeFirebaseFirestore();
    auth = MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid, email: 'rahul@example.com'));
    session = ParentSession(db: db, auth: auth);
    await db.doc('users/$uid').set({
      'schoolId': sid, 'role': 'parent', 'email': 'rahul@example.com', 'name': 'Mr. Rahul Sharma',
      'studentIds': [child], 'classIds': ['cls_10B'], 'grns': ['GIS-9200'],
    });
    await put('students', child, {
      'name': 'Aarav Sharma', 'grade': '10', 'section': 'B', 'classId': 'cls_10B', 'roll': 7, 'grn': 'GIS-9200',
      'guardian': 'Mr. Rahul Sharma', 'relation': 'Father', 'phone': '+91 98100 00001', 'address': '12 Park Street',
      'dob': '2010-08-14', 'gender': 'Male', 'bloodGroup': 'B+', 'guardianUids': [uid],
    });
    await put('classes', 'cls_10B', {'grade': '10', 'section': 'B', 'classTeacherId': 'stf_025', 'classTeacher': 'Mrs. Anita Sharma', 'room': '204'});
    await put('school', 'school', {'name': 'Greenfield International School', 'academicYear': '2026-27'});
    for (final (i, t, s) in [(1, 'stf_025', 'Mathematics'), (2, 'stf_010', 'English'), (3, 'stf_003', 'Physical Education')]) {
      await db.collection('schools/$sid/ops_periods').add({
        'classId': 'cls_10B', 'day': 'Mon', 'period': i, 'subject': s, 'teacherId': t,
        'teacher': {'stf_025': 'Mrs. Anita Sharma', 'stf_010': 'Dr. Isha Joshi', 'stf_003': 'Mr. Vikram Rao'}[t],
      });
    }
    await session.load();
  });

  group('auth', () {
    test('email + password: signs in, guardian from users / students, challenge already verified', () async {
      await auth.signOut();
      final repo = FirebaseAuthRepository(session, ParentPushService());
      final c = await repo.requestOtpWithPassword(' rahul@example.com ', 'secret');
      expect(c.verified, isTrue);
      final g = await repo.verifyOtp(c, '');
      expect(g.id, uid);
      expect(g.name, 'Mr. Rahul Sharma');
      expect(g.relation, 'Father');
      expect(g.phone, '+91 98100 00001');
      expect((await repo.currentGuardian())!.id, uid);
      await repo.logout();
      expect(session.schoolId, isEmpty);
      expect(auth.currentUser, isNull);
    });

    test('bad credentials become a readable error', () async {
      final failing = ParentSession(db: db, auth: _FailingAuth('wrong-password'));
      final repo = FirebaseAuthRepository(failing, ParentPushService());
      expect(repo.requestOtpWithPassword('rahul@example.com', 'x'), appError('Incorrect email or password.'));
    });

    test('a login that is not a parent is signed out again', () async {
      await db.doc('users/$uid').update({'role': 'teacher'});
      final repo = FirebaseAuthRepository(session, ParentPushService());
      await expectLater(repo.requestOtpWithPassword('rahul@example.com', 'x'), appError('not a parent login'));
      expect(auth.currentUser, isNull);
    });

    test('mobile passcode and Google / Apple are not set up: clear messages', () async {
      final repo = FirebaseAuthRepository(session, ParentPushService());
      expect(repo.requestOtpForMobile('9876543210'), appError('mobile number is not available'));
      expect(repo.signInWithProvider(SocialProvider.google), appError('Google sign-in is not set up'));
    });

    test('password reset: needs an email, maps Firebase errors', () async {
      final repo = FirebaseAuthRepository(session, ParentPushService());
      expect(repo.sendPasswordReset('rahul'), appError('Enter a valid email address.'));
      await repo.sendPasswordReset('rahul@example.com');
      final limited = FirebaseAuthRepository(ParentSession(db: db, auth: _FailingAuth('too-many-requests')), ParentPushService());
      expect(limited.sendPasswordReset('rahul@example.com'), appError('Too many attempts'));
    });

    test('error codes', () {
      String m(String code) => FirebaseAuthRepository.authMessage(FirebaseAuthException(code: code));
      expect(m('user-disabled'), 'This login has been disabled. Contact the school office.');
      expect(m('network-request-failed'), 'No internet connection. Check your network and try again.');
      expect(m('user-not-found'), 'Incorrect email or password.');
    });

    test('registration points to the school office', () async {
      final repo = FirebaseRegistrationRepository();
      expect(repo.lookupStudent('GIS-2021-0142', DateTime(2010, 8, 14)), appError('created by the school'));
    });
  });

  group('family and profile', () {
    test('family follows users/{uid}: a newly linked child appears', () async {
      await put('students', 'stu_102', {'name': 'Ananya Sharma', 'grade': '8', 'section': 'C', 'classId': 'cls_8C', 'roll': 3});
      final seen = <int>[];
      final sub = FirebaseFamilyRepository(session).watchFamily().listen((f) => seen.add(f.children.length));
      await pumpEventQueue();
      expect(seen.last, 1);
      await db.doc('users/$uid').update({'studentIds': [child, 'stu_102']});
      await pumpEventQueue();
      expect(seen.last, 2);
      await sub.cancel();
    });

    test('profile: school record, edits refused with the reason, photo kept on the device', () async {
      final repo = FirebaseProfileRepository(session, FirebaseFamilyRepository(session), storage);
      final seen = <int?>[];
      final sub = repo.watchProfile().listen((p) => seen.add(p.photoStyle));
      final p = await repo.watchProfile().first;
      expect(p.guardian.name, 'Mr. Rahul Sharma');
      expect(p.parentId, 'rahul@example.com');
      expect(p.address, '12 Park Street');
      expect(p.phoneVerified, isTrue);
      expect(repo.updateProfile(p), appError('Ask the school office'));
      await repo.setPhoto(3);
      await pumpEventQueue();
      expect(seen.last, 3);
      expect(storage.getString('profile_photo:$uid'), '3');
      await repo.setPhoto(null);
      await pumpEventQueue();
      expect(seen.last, isNull);
      await sub.cancel();
    });
  });

  group('notifications', () {
    setUp(() async {
      await put('par_notifications', 'n_att', {'uid': uid, 'studentId': child, 'type': 'attendance', 'title': 'Absence alert', 'body': 'Aarav was marked absent today', 'route': '/academics?section=attendance', 'read': false, 'at': '2026-10-26T04:00:00Z'});
      await put('par_notifications', 'n_fee', {'uid': uid, 'type': 'fees', 'title': 'Fee due in 3 days', 'body': '', 'route': '/fees', 'read': true, 'at': '2026-10-25T04:00:00Z'});
      await put('par_notifications', 'ntc_n1_$uid', {'uid': uid, 'type': 'notice', 'title': 'Urgent: Fog advisory', 'body': 'Late start', 'route': '/notifications', 'read': false, 'at': '2026-10-27T04:00:00Z'});
      await put('par_notifications', 'n_other', {'uid': 'par_2', 'type': 'fees', 'title': 'Not mine', 'read': false, 'at': '2026-10-28T04:00:00Z'});
      await put('com_notices', 'n1', {'title': 'Fog advisory', 'parentVisible': true, 'urgent': true});
    });

    FirebaseNotificationRepository repo() => FirebaseNotificationRepository(session, FirebaseNoticeRepository(session), storage);

    test('own rows only, newest first, categories, routes and the notice link', () async {
      final list = await repo().watchNotifications().first;
      expect(list.map((n) => n.id), ['ntc_n1_$uid', 'n_att', 'n_fee']);
      expect(list[0].category, NotificationCategory.emergency);
      expect(list[0].noticeId, 'n1');
      expect(list[0].requiresAck, isTrue);
      expect(list[1].category, NotificationCategory.emergency); // absence alert
      expect(list[1].actionRoute, '/academics?section=attendance');
      expect(list[2].category, NotificationCategory.fees);
      expect(list[2].read, isTrue);
      expect(await repo().watchUnreadCount().first, 2);
    });

    test('mark read, mark all read, hide on this device, acknowledge a notice', () async {
      final r = repo();
      await r.markRead('n_att');
      expect((await get('par_notifications', 'n_att'))['read'], isTrue);
      await r.markAllRead();
      expect((await get('par_notifications', 'ntc_n1_$uid'))['read'], isTrue);
      expect((await get('par_notifications', 'n_other'))['read'], isFalse);
      await r.delete('n_fee');
      expect((await r.watchNotifications().first).map((n) => n.id), isNot(contains('n_fee')));
      expect((await get('par_notifications', 'n_fee')), isNotEmpty); // parents may only set `read`
      await r.acknowledge('ntc_n1_$uid');
      expect((await db.doc('schools/$sid/com_notices/n1/acks/$uid').get()).exists, isTrue);
    });

    test('notice id from the row id', () {
      expect(FirebaseNotificationRepository.noticeIdOf('ntc_abc_def_$uid', uid), 'abc_def');
      expect(FirebaseNotificationRepository.noticeIdOf('n_att', uid), isNull);
    });
  });

  group('notices for the child\'s class', () {
    test('grade labels as the admin web writes them ("Grade 10-B", "Grade 9")', () {
      expect(FirebaseNoticeRepository.forClass([], '10', 'B'), isTrue);
      expect(FirebaseNoticeRepository.forClass(['Grade 10-B'], '10', 'B'), isTrue);
      expect(FirebaseNoticeRepository.forClass(['Grade 10'], '10', 'B'), isTrue);
      expect(FirebaseNoticeRepository.forClass(['10B'], '10', 'B'), isTrue);
      expect(FirebaseNoticeRepository.forClass(['Grade 10-A'], '10', 'B'), isFalse);
      expect(FirebaseNoticeRepository.forClass(['Grade 8-A', 'Grade 9'], '10', 'B'), isFalse);
      expect(FirebaseNoticeRepository.forClass(['Grade 1'], '10', 'B'), isFalse);
    });

    test('a notice for "Grade 10-B" reaches a 10-B parent (was hidden before)', () async {
      await put('com_notices', 'a', {'title': 'For 10-B', 'parentVisible': true, 'grades': ['Grade 10-B'], 'sentAt': '2026-10-26T09:00:00Z'});
      await put('com_notices', 'b', {'title': 'For 10-A', 'parentVisible': true, 'grades': ['Grade 10-A'], 'sentAt': '2026-10-26T09:00:00Z'});
      final list = await FirebaseNoticeRepository(session).watchNotices(child).first;
      expect(list.map((n) => n.id), ['a']);
    });

    test('categories from the admin web labels', () {
      expect(FirebaseNoticeRepository.categoryOf({'category': 'Holidays'}).name, 'holiday');
      expect(FirebaseNoticeRepository.categoryOf({'category': 'Academic & Events'}).name, 'event');
      expect(FirebaseNoticeRepository.categoryOf({'category': 'General', 'urgent': true}).name, 'urgent');
    });
  });

  group('student profile and certificates', () {
    test('profile: identity, class teacher, year, attendance and score from published results', () async {
      await put('par_attendance', '${child}_2026-10', {'studentId': child, 'days': {'2026-10-26': 'A', '2026-10-27': 'P', '2026-10-28': 'L', '2026-10-29': 'P'}});
      await put('par_results', '${child}_p1', {'studentId': child, 'obtained': 80, 'max': 100});
      await put('par_results', '${child}_p2', {'studentId': child, 'obtained': 70, 'max': 100});
      final p = await FirebaseStudentRepository(session, FakeLauncher()).watchProfile(child).first;
      expect(p.child.name, 'Aarav Sharma');
      expect(p.child.classTeacher, 'Mrs. Anita Sharma');
      expect(p.child.rollNo, 7);
      expect(p.academicYear, '2026-27');
      expect(p.dob, DateTime(2010, 8, 14));
      expect((p.present, p.absent, p.workingDays), (3, 1, 4));
      expect(p.attendancePercent, 75);
      expect(p.cgpa, 7.5);
      expect(p.evaluation, '2 subjects published');
      expect(p.medical.bloodGroup, 'B+');
      expect(p.guardians.single.relation, 'Father');
      expect(p.transport.onBus, isFalse);
    });

    test('request: the doc the office sees; rejected ones are hidden', () async {
      final repo = FirebaseStudentRepository(session, FakeLauncher());
      final c = await repo.requestCertificate(childId: child, type: CertificateRequestType.bonafide, purpose: ' Passport ');
      expect(c.requested, isTrue);
      final d = await get('certificates', c.id);
      expect(d['status'], 'Requested');
      expect(d['type'], 'bonafide');
      expect(d['title'], 'Bonafide Certificate');
      expect(d['purpose'], 'Passport');
      expect(d['classId'], 'cls_10B');
      expect(d['grn'], 'GIS-9200');
      expect(d['parentUid'], uid);
      expect(d.containsKey('refNo'), isFalse);
      await put('certificates', 'rej', {'studentId': child, 'status': 'Rejected', 'title': 'TC'});
      final list = await repo.watchCertificates(child).first;
      expect(list.map((c) => c.id), [c.id]);
    });

    test('download: issued with a file opens it and records the download; without a file / not issued explain why', () async {
      final launcher = FakeLauncher();
      final repo = FirebaseStudentRepository(session, launcher);
      await put('certificates', 'c1', {'studentId': child, 'status': 'Issued', 'title': 'Bonafide', 'refNo': 'CERT/2026/0001', 'issuedOn': '2026-10-20', 'fileUrl': 'https://files.example/c1.pdf', 'issuer': 'Principal'});
      await put('certificates', 'c2', {'studentId': child, 'status': 'Issued', 'title': 'Character', 'refNo': 'CERT/2026/0002'});
      await put('certificates', 'c3', {'studentId': child, 'status': 'Requested', 'title': 'TC'});
      final c = await repo.recordDownload(childId: child, certificateId: 'c1');
      expect(launcher.opened, ['https://files.example/c1.pdf']);
      expect(c.downloadedAt, isNotNull);
      expect((await get('certificates', 'c1'))['downloadedAt'], isNotNull);
      expect(repo.recordDownload(childId: child, certificateId: 'c2'), appError('ready to collect from the school office'));
      expect(repo.recordDownload(childId: child, certificateId: 'c3'), appError('still being prepared'));
      final issued = FirebaseStudentRepository.certificateFromDoc('c1', await get('certificates', 'c1'), child);
      expect(issued.refNo, 'CERT/2026/0001');
      expect(issued.issuedOn, DateTime(2026, 10, 20));
      expect(issued.signature, 'Signed by Principal');
    });
  });

  group('teachers', () {
    test('class teacher plus the timetable\'s subject teachers, reachable through Messages', () async {
      final t = await FirebaseTeachersRepository(session).watchTeachers(child).first;
      expect(t.className, '10-B');
      expect(t.classTeacher.id, 'stf_025');
      expect(t.classTeacher.isClassTeacher, isTrue);
      expect(t.classTeacher.designation, 'Class Teacher, 10-B');
      expect(t.classTeacher.room, '204');
      expect(t.classTeacher.category, TeacherCategory.coreSciences);
      expect(t.faculty.map((f) => f.name), ['Dr. Isha Joshi', 'Mr. Vikram Rao']);
      expect(t.faculty.first.category, TeacherCategory.languages);
      expect(t.faculty.last.category, TeacherCategory.electives);
      expect(t.faculty.first.threadId, 'thr_${child}_stf_010');
      expect(t.faculty.first.phone, isEmpty); // staff numbers are not shared with parents
    });
  });

  group('parent-teacher meetings', () {
    late int future;
    setUp(() async {
      future = DateTime.now().add(const Duration(days: 2)).millisecondsSinceEpoch;
      Future<void> slot(String id, String teacher, int startMs, {bool booked = false, List<String> modes = const ['In-Person', 'Virtual']}) =>
          put('ptm_slots', id, {'teacherId': teacher, 'teacher': 'T $teacher', 'start': DateTime.fromMillisecondsSinceEpoch(startMs).toUtc().toIso8601String(), 'startMs': startMs, 'mins': 15, 'modes': modes, 'room': 'Room 12', 'link': '', 'booked': booked});
      await slot('s1', 'stf_025', future);
      await slot('s2', 'stf_025', future + 900000);
      await slot('s3', 'stf_999', future); // not this child's teacher
      await slot('s4', 'stf_010', future, booked: true);
      await slot('s5', 'stf_010', future + 900000, modes: ['In-Person']);
    });

    FirebasePtmRepository repo() => FirebasePtmRepository(session, FirebaseTeachersRepository(session));

    test('slots of the child\'s teachers only', () async {
      final d = await repo().watchPtm(child).first;
      expect(d.slots.map((s) => s.id).toSet(), {'s1', 's2', 's4', 's5'});
      expect(d.slots.firstWhere((s) => s.id == 's4').booked, isTrue);
      expect(d.teachers.map((t) => t.id), contains('stf_025'));
      expect(d.meetings, isEmpty);
    });

    test('book copies the slot, refuses taken slots and modes the slot does not offer', () async {
      final m = await repo().book(childId: child, teacherId: 'stf_025', slotId: 's1', mode: MeetingMode.virtual, agenda: ' Maths progress ');
      expect(m.status, MeetingStatus.scheduled);
      final b = await get('ptm_bookings', 's1');
      expect(b['studentId'], child);
      expect(b['classId'], 'cls_10B');
      expect(b['parentUid'], uid);
      expect(b['mode'], 'Virtual');
      expect(b['agenda'], 'Maths progress');
      expect(b['startMs'], future);
      expect(b['room'], 'Room 12');
      expect(b['status'], 'Scheduled');
      expect(repo().book(childId: child, teacherId: 'stf_010', slotId: 's4', mode: MeetingMode.inPerson, agenda: 'x'), appError('just taken'));
      expect(repo().book(childId: child, teacherId: 'stf_010', slotId: 's5', mode: MeetingMode.virtual, agenda: 'x'), appError('in-person only'));
      expect(repo().book(childId: child, teacherId: 'stf_025', slotId: 'nope', mode: MeetingMode.virtual, agenda: 'x'), appError('no longer offered'));
    });

    test('reschedule cancels the old booking and books the new slot; cancel and join are recorded', () async {
      final r = repo();
      await r.book(childId: child, teacherId: 'stf_025', slotId: 's1', mode: MeetingMode.inPerson, agenda: 'Progress');
      final moved = await r.reschedule(childId: child, meetingId: 's1', slotId: 's2');
      expect(moved.id, 's2');
      expect((await get('ptm_bookings', 's1'))['status'], 'Cancelled');
      expect((await get('ptm_bookings', 's1'))['cancelledBy'], 'parent');
      expect((await get('ptm_bookings', 's2'))['agenda'], 'Progress');
      await r.recordJoin(childId: child, meetingId: 's2');
      expect((await get('ptm_bookings', 's2'))['joinedAt'], isNotNull);
      await r.cancel(childId: child, meetingId: 's2');
      expect((await get('ptm_bookings', 's2'))['status'], 'Cancelled');
      expect(r.reschedule(childId: child, meetingId: 's2', slotId: 's1'), appError('can no longer be changed'));
      final d = await r.watchPtm(child).first;
      expect(d.meetings.every((m) => m.status == MeetingStatus.cancelled), isTrue);
    });

    test('meeting mapping: minutes shared by the school, Meet link for virtual', () {
      final m = FirebasePtmRepository.meetingFromDoc('s1', {'teacherId': 'stf_025', 'teacher': 'Mrs. Anita Sharma', 'mode': 'Virtual', 'link': 'https://meet.google.com/abc-defg-hij', 'status': 'Attended', 'minutes': ' Doing well ', 'startMs': future, 'mins': 15}, child, null);
      expect(m.status, MeetingStatus.attended);
      expect(m.minutes, 'Doing well');
      expect(m.link, 'https://meet.google.com/abc-defg-hij');
      expect(m.location, 'Google Meet');
      expect(m.mins, 15);
    });
  });

  group('fees: reporting a payment to the school account', () {
    setUp(() async {
      await put('fee_invoices', 'inv_1', {'grn': 'GIS-9200', 'no': 'INV-1001', 'term': 'Term 2', 'issued': '2026-10-01', 'due': '2026-10-15', 'amount': 30000, 'paid': 10000});
      await put('school', 'school', {'academicYear': '2026-27', 'bank': {'accountName': 'Greenfield School', 'accountNo': '1234567890', 'ifsc': 'HDFC0001234', 'bank': 'HDFC', 'upiId': 'school@hdfc'}});
    });

    test('claim doc: upper-case reference, Pending, the child and invoice; shows in the list with the bank account', () async {
      final repo = FirebaseFeeRepository(session);
      final c = await repo.reportPayment(childId: child, invoiceId: 'inv_1', amount: 20000, mode: TransferMode.upi, reference: ' utr123456789 ', paidOn: DateTime(2026, 10, 27), note: ' paid ');
      expect(c.status, ClaimStatus.pending);
      final d = await get('fee_claims', c.id);
      expect(d['reference'], 'UTR123456789');
      expect(d['mode'], 'UPI');
      expect(d['paidOn'], '2026-10-27');
      expect(d['invoiceNo'], 'INV-1001');
      expect(d['grn'], 'GIS-9200');
      expect(d['parentUid'], uid);
      expect(d['note'], 'paid');
      expect(d['status'], 'Pending');
      final f = await repo.watchFees(child).first;
      expect(f.claims.single.invoiceTitle, 'Term 2 Fees');
      expect(f.bank!.upiId, 'school@hdfc');
    });

    test('refused: no amount, short reference, unknown invoice, a reference already reported', () async {
      final repo = FirebaseFeeRepository(session);
      Future<PaymentClaim> report({double amount = 100, String ref = 'UTR123456789', String inv = 'inv_1'}) =>
          repo.reportPayment(childId: child, invoiceId: inv, amount: amount, mode: TransferMode.upi, reference: ref, paidOn: DateTime(2026, 10, 27));
      expect(report(amount: 0), appError('Enter the amount you paid.'));
      expect(report(ref: 'ab'), appError('Enter the UPI transaction ID (UTR).'));
      expect(report(inv: 'nope'), appError('This instalment was not found.'));
      await report();
      expect(report(ref: 'utr123456789'), appError('already reported'));
    });

    test('a rejected claim frees its reference; verified claims carry the receipt', () async {
      await put('fee_claims', 'cl_1', {'studentId': child, 'invoiceId': 'inv_1', 'reference': 'UTR999', 'status': 'Rejected', 'rejectReason': 'Not received', 'amount': 5, 'mode': 'UPI', 'submittedAt': '2026-10-20T00:00:00Z'});
      await put('fee_claims', 'cl_2', {'studentId': child, 'invoiceId': 'inv_1', 'reference': 'UTR888', 'status': 'Verified', 'receiptNo': 'RCPT-77', 'amount': 5, 'mode': 'Cheque', 'submittedAt': '2026-10-21T00:00:00Z'});
      final repo = FirebaseFeeRepository(session);
      await repo.reportPayment(childId: child, invoiceId: 'inv_1', amount: 5, mode: TransferMode.upi, reference: 'UTR999', paidOn: DateTime(2026, 10, 27));
      final claims = (await repo.watchFees(child).first).claims;
      final verified = claims.firstWhere((c) => c.id == 'cl_2');
      expect(verified.status, ClaimStatus.verified);
      expect(verified.receiptNo, 'RCPT-77');
      expect(verified.mode, TransferMode.cheque);
      expect(claims.firstWhere((c) => c.id == 'cl_1').reason, 'Not received');
    });

    test('receipts from fee_payments; no gateway and no receipt PDF: both say so', () async {
      await put('fee_payments', 'pay_1', {'grn': 'GIS-9200', 'receiptNo': 'RCPT-1', 'date': '2026-10-28', 'amount': 20000, 'mode': 'UPI · UTR123', 'invoiceNo': 'INV-1001'});
      final repo = FirebaseFeeRepository(session);
      final r = (await repo.watchFees(child).first).receipts.single;
      expect(r.number, 'RCPT-1');
      expect(r.method, PaymentMethod.upi);
      expect(r.reference, 'INV-1001');
      expect(repo.pay(childId: child, invoiceIds: ['inv_1'], method: PaymentMethod.upi), appError('Pay into the school account'));
      expect(repo.downloadReceipt(r), appError('Receipt RCPT-1 is recorded by the school'));
    });
  });

  group('leave overview and behaviour', () {
    test('leave overview: history plus the attendance base from par_attendance', () async {
      await put('par_attendance', '${child}_2026-10', {'studentId': child, 'days': {'2026-10-26': 'A', '2026-10-27': 'P', '2026-10-28': 'H', '2026-10-29': 'L'}});
      final repo = FirebaseLeaveRepository(session);
      await repo.apply(childId: child, from: DateTime(2026, 11, 4), to: DateTime(2026, 11, 4), reason: 'Family function');
      final o = await repo.watchOverview(child).first;
      expect(o.history.single.reason, 'Family function');
      expect(o.workingDays, 4);
      expect(o.attendedDays, 2.5);
    });

    test('behaviour: no conduct data is shared with parents yet', () async {
      final repo = FirebaseBehaviourRepository();
      final r = await repo.watchReport(child).first;
      expect(r.entries, isEmpty);
      expect(repo.acknowledge(child, 'e1'), appError('not shared through the app yet'));
    });
  });
}

/// Firebase Auth that rejects sign-in and password reset with [code].
class _FailingAuth extends MockFirebaseAuth {
  _FailingAuth(this.code);
  final String code;

  @override
  Future<UserCredential> signInWithEmailAndPassword({required String email, required String password}) async =>
      throw FirebaseAuthException(code: code);

  @override
  Future<void> sendPasswordResetEmail({required String email, ActionCodeSettings? actionCodeSettings}) async =>
      throw FirebaseAuthException(code: code);
}
