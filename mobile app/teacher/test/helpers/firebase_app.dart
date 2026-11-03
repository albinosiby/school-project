import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/utils/services/firebase/firestore_data_store.dart';
import 'package:teacher_app/utils/services/firebase/store_adapters.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'fake_gateway.dart';

/// The app wired to the shared-Firestore backend (`BACKEND=firebase`) with an in-memory [FakeGateway] instead of the
/// network: every repository reads and writes the [FirestoreDataStore] through the real adapters, so a test sees exactly
/// which remote documents a screen or BLoC writes.

String isoDay(int offset) => DateFormat('yyyy-MM-dd').format(DateTime.now().add(Duration(days: offset)));
String get todayKey => isoDay(0);
String get todayName => DateTime.now().weekday <= 6 ? kDays[DateTime.now().weekday - 1] : 'Sun';

const fbCtx = AdapterContext(schoolId: 'sch_1', staffId: 'stf_025', authUid: 'uid_anita');

/// A small school in the contract's shapes (admin web + parent app writes), dates relative to today.
Remote schoolFixture() => {
      'school': [{'id': 'school', 'name': 'Greenfield International School', 'academicYear': '2026-27', 'term': 'Term 2'}],
      'staff': [
        {'id': 'stf_025', 'name': 'Mrs. Anita Sharma', 'empId': 'EMP-2041', 'department': 'Mathematics', 'role': 'PGT', 'designation': 'Senior Faculty', 'email': 'anita.sharma@greenfield.edu', 'phone': '98100 00025', 'subjects': 'Mathematics & Science', 'authUid': 'uid_anita'},
        {'id': 'stf_003', 'name': 'Dr. Myra Sharma', 'department': 'Science', 'role': 'HOD', 'status': 'Active'},
        {'id': 'stf_008', 'name': 'Mr. Rohan Verma', 'department': 'English', 'role': 'TGT', 'status': 'Active'},
        {'id': 'stf_090', 'name': 'Mr. Office Clerk', 'department': 'Accounts', 'role': 'Clerk', 'status': 'Active'},
      ],
      'classes': [
        {'id': 'cls_10B', 'grade': '10', 'section': 'B', 'classTeacherId': 'stf_025', 'room': 'Room 204', 'wing': 'North Wing', 'studentCount': 2},
        {'id': 'cls_8C', 'grade': '8', 'section': 'C', 'classTeacherId': 'stf_003', 'room': 'Room 118', 'wing': 'South Wing', 'studentCount': 1},
      ],
      'assignments': [
        {'id': 'asg_1', 'classId': 'cls_10B', 'subject': 'Mathematics', 'teacherId': 'stf_025', 'topic': 'Quadratic Equations'},
        {'id': 'asg_2', 'classId': 'cls_8C', 'subject': 'Physics', 'teacherId': 'stf_025'},
        {'id': 'asg_3', 'classId': 'cls_9A', 'subject': 'English', 'teacherId': 'stf_008'},
      ],
      'students': [
        {'id': 'stu_101', 'name': 'Aarav Sharma', 'grn': 'GIS-9200', 'classId': 'cls_10B', 'roll': 1, 'guardian': 'Mr. Sharma', 'phone': '9', 'attendance': 92, 'perfGrade': 'A1', 'guardianUids': ['par_1']},
        {'id': 'stu_102', 'name': 'Ananya Reddy', 'grn': 'GIS-9201', 'classId': 'cls_10B', 'roll': 2, 'guardian': 'Mrs. Reddy', 'phone': '8', 'attendance': 81, 'guardianUids': <String>[]},
        {'id': 'stu_201', 'name': 'Kabir Khan', 'grn': 'GIS-8100', 'classId': 'cls_8C', 'roll': 1, 'guardian': 'Mr. Khan', 'phone': '7', 'attendance': 88},
      ],
      'ops_periods': [
        {'id': 'per_10B_${todayName}_3', 'classId': 'cls_10B', 'grade': '10', 'section': 'B', 'day': todayName, 'period': 3, 'subject': 'Mathematics', 'teacher': 'Mrs. Anita Sharma', 'teacherId': 'stf_025', 'room': 'Room 204'},
        {'id': 'per_8C_Fri_2', 'classId': 'cls_8C', 'grade': '8', 'section': 'C', 'day': 'Fri', 'period': 2, 'subject': 'Physics', 'teacherId': 'stf_025', 'room': 'Room 118'},
        {'id': 'per_9A_${todayName}_3', 'classId': 'cls_9A', 'grade': '9', 'section': 'A', 'day': todayName, 'period': 3, 'subject': 'English', 'teacherId': 'stf_008', 'room': 'Room 110'},
      ],
      'ops_substitutions': [
        {'id': 'sub_1', 'date': todayKey, 'day': todayName, 'period': 5, 'classId': 'cls_8C', 'subject': 'Physics', 'absentTeacherId': 'stf_003', 'substituteTeacherId': 'stf_025', 'status': 'Assigned', 'topic': 'Friction'},
      ],
      'exm_cycles': [{'id': 'cyc_1', 'title': 'Half-Yearly Examination', 'short': 'Half-Yearly'}],
      'exm_papers': [
        {'id': 'pap_open', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'code': 'MA-10', 'theory': 80, 'classIds': ['cls_10B'], 'date': isoDay(-3), 'start': '09:00', 'duration': 3, 'venue': 'Hall A'},
        {'id': 'pap_locked', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'classIds': ['cls_10B'], 'date': isoDay(-10), 'locked': true},
        {'id': 'pap_pub', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'classIds': ['cls_10B'], 'date': isoDay(-20), 'published': ['10-B']},
      ],
      'exm_candidates': [
        {'id': 'cand_stu_101', 'studentId': 'stu_101', 'name': 'Aarav Sharma', 'roll': '#10B-01', 'grn': 'GIS-9200', 'cls': '10-B', 'grade': '10', 'section': 'B'},
        {'id': 'cand_stu_102', 'studentId': 'stu_102', 'name': 'Ananya Reddy', 'roll': '#10B-02', 'grn': 'GIS-9201', 'cls': '10-B', 'grade': '10', 'section': 'B'},
      ],
      'exm_duties': [
        {'id': 'dut_1', 'paperId': 'pap_open', 'cycleId': 'cyc_1', 'staffId': 'stf_025', 'role': 'Invigilator', 'hall': 'Hall A', 'date': isoDay(2), 'start': '09:00', 'end': '12:00', 'status': 'upcoming', 'reportBy': '08:30'},
        {'id': 'dut_2', 'paperId': 'pap_open', 'cycleId': 'cyc_1', 'staffId': 'stf_003', 'role': 'Chief Invigilator', 'hall': 'Hall A', 'date': isoDay(2), 'start': '09:00', 'end': '12:00', 'status': 'upcoming'},
      ],
      'set_leave_policy': [
        {'id': 'policy', 'checkInBy': '08:15', 'types': [
          {'id': 'CL', 'name': 'Casual (CL)', 'type': 'Casual Leave', 'total': 12},
          {'id': 'ML', 'name': 'Medical (ML)', 'type': 'Medical Leave', 'total': 10},
          {'id': 'EL', 'name': 'Earned (EL)', 'type': 'Earned Leave', 'total': 15},
        ]},
      ],
      'staff_leaves': [
        {'id': 'slv_pending', 'staffId': 'stf_025', 'teacherId': 'stf_025', 'type': 'Casual Leave', 'from': isoDay(5), 'to': isoDay(5), 'days': 1, 'reason': 'Family function', 'status': 'Pending', 'createdAt': '${isoDay(-1)}T10:00:00'},
        {'id': 'slv_approved', 'staffId': 'stf_025', 'teacherId': 'stf_025', 'type': 'Casual Leave', 'from': isoDay(9), 'to': isoDay(10), 'days': 2, 'reason': 'Wedding', 'status': 'Approved', 'decidedBy': 'uid_admin', 'decidedAt': '${isoDay(-2)}T10:00:00'},
      ],
      'student_leaves': [
        {'id': 'sl_1', 'studentId': 'stu_101', 'classId': 'cls_10B', 'from': isoDay(1), 'to': isoDay(2), 'reason': 'Family function', 'status': 'Pending', 'parentUid': 'par_1', 'name': 'Aarav Sharma', 'roll': 1, 'days': 2, 'daysLabel': '2 Days', 'dateText': 'Soon', 'type': 'Personal Leave', 'cat': 'leave', 'by': 'Mr. Sharma (Father)', 'appliedOn': isoDay(0)},
        {'id': 'sl_med', 'studentId': 'stu_102', 'classId': 'cls_10B', 'from': isoDay(-2), 'to': isoDay(-1), 'reason': 'Viral fever', 'status': 'Pending', 'parentUid': 'par_2', 'name': 'Ananya Reddy', 'roll': 2, 'days': 2, 'type': 'Medical Leave', 'cat': 'medical', 'by': 'Mrs. Reddy (Mother)', 'appliedOn': isoDay(-1), 'attachment': {'name': 'Fever_Certificate.pdf'}},
      ],
      'ops_homework': [
        {'id': 'hw_admin', 'title': 'Distance Formula', 'classId': 'cls_10B', 'teacherId': 'stf_025', 'subject': 'Mathematics', 'due': isoDay(3), 'assigned': isoDay(-1), 'submitted': 0, 'total': 2},
      ],
      'live_classes': [
        {'id': 'lc_1', 'title': 'Quadratics doubt clearing', 'classId': 'cls_10B', 'subject': 'Mathematics', 'teacherId': 'stf_025', 'date': isoDay(1), 'time': '16:00', 'mins': 45, 'medium': 'Google Meet', 'link': 'https://meet.google.com/abc-defg-hij', 'status': 'upcoming'},
      ],
      'msg_threads': [
        {'id': 'thr_stu_101_stf_025', 'studentId': 'stu_101', 'classId': 'cls_10B', 'studentName': 'Aarav Sharma', 'parentUids': ['par_1'], 'guardian': 'Mr. Sharma', 'teacherId': 'stf_025', 'teacher': 'Mrs. Anita Sharma', 'role': 'Class Teacher', 'lastMessage': 'Is the test on Friday?', 'lastFrom': 'parent', 'unreadTeacher': 1, 'unreadParent': 0},
      ],
      'msg_messages': [
        {'id': 'msg_p1', 'threadId': 'thr_stu_101_stf_025', 'studentId': 'stu_101', 'teacherId': 'stf_025', 'parentUids': ['par_1'], 'from': 'parent', 'uid': 'par_1', 'name': 'Mr. Sharma', 'text': 'Is the test on Friday?', 'at': '${isoDay(0)}T07:00:00'},
      ],
      'com_notices': [
        {'id': 'ntc_1', 'title': 'Staff meeting', 'category': 'Staff', 'audience': 'Staff & Teachers', 'status': 'Published', 'sentAt': '${isoDay(-1)}T15:30:00', 'author': 'Principal', 'body': 'At 3:30'},
      ],
    };

/// Flushes the fake listeners (each query delivers on a microtask, second-phase queries start after the first).
Future<void> settle([int rounds = 12]) async {
  for (var i = 0; i < rounds; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

/// Fresh DI container whose repositories run on a started [FirestoreDataStore] over [schoolFixture].
Future<({FirestoreDataStore store, FakeGateway gw})> setUpFirebaseApp({Remote? extra, List<String> warm = const []}) async {
  SharedPreferences.setMockInitialValues({'onboarding_complete': true});
  await configureDependencies(db: LocalDatabaseService.memory({}));
  final gw = FakeGateway();
  final store = FirestoreDataStore(gw, adapters: firebaseAdapters());
  getIt.allowReassignment = true;
  getIt.registerSingleton<DataStore>(store);
  getIt.allowReassignment = false;
  store.start(fbCtx);
  gw.load({...schoolFixture(), ...?extra});
  await settle();
  // collections load lazily on first read: open the ones the test needs so their listeners have delivered
  for (final c in warm) {
    store.list(c);
  }
  await settle();
  return (store: store, gw: gw);
}

/// Writes to [collection] since [from] (index into [FakeGateway.writes]).
List<RemoteWrite> writesTo(FakeGateway gw, String collection, [int from = 0]) => [for (final w in gw.writes.skip(from)) if (w.collection == collection) w];
