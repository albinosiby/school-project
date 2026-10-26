import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/modules/engage/models/exam_duty_models.dart';
import 'package:teacher_app/utils/services/data_store.dart';
import 'package:teacher_app/utils/services/firebase/firestore_data_store.dart';
import 'package:teacher_app/utils/services/firebase/remote_gateway.dart';
import 'package:teacher_app/utils/services/firebase/store_adapters.dart';

final _now = DateTime(2026, 10, 26, 9); // a Monday
final ctx = AdapterContext(schoolId: 's1', staffId: 'stf_025', authUid: 'uid1', clock: () => _now);

final Remote fake = {
  'staff': [
    {'id': 'stf_025', 'name': 'Mrs. Anita Sharma', 'empId': 'EMP-2041', 'department': 'Mathematics', 'role': 'PGT', 'email': 'a@x.edu', 'phone': '1', 'subjects': 'Math & Science', 'designation': 'Senior Faculty', 'joined': '2014-06-02'},
    {'id': 'stf_003', 'name': 'Dr. Myra Sharma', 'department': 'Science', 'role': 'HOD'},
  ],
  'school': [{'id': 'school', 'name': 'Greenfield International School', 'academicYear': '2026-27', 'term': 'Term 2'}],
  'classes': [
    {'id': 'cls_10B', 'grade': '10', 'section': 'B', 'classTeacherId': 'stf_025', 'room': 'Room 204', 'wing': 'North Wing', 'studentCount': 42},
    {'id': 'cls_8C', 'grade': '8', 'section': 'C', 'classTeacherId': 'stf_002', 'room': 'Room 118', 'wing': 'South Wing'},
  ],
  'assignments': [
    {'id': 'asg_1', 'classId': 'cls_10B', 'subject': 'Mathematics', 'teacherId': 'stf_025', 'topic': 'Coordinate Geometry'},
    {'id': 'asg_2', 'classId': 'cls_8C', 'subject': 'Physics', 'teacherId': 'stf_025'},
    {'id': 'asg_3', 'classId': 'cls_9A', 'subject': 'English', 'teacherId': 'stf_008'},
  ],
  'students': [
    {'id': 'stu_102', 'name': 'Ananya Reddy', 'grn': 'GIS-9201', 'classId': 'cls_10B', 'roll': 2, 'guardian': 'Mrs. Rao', 'phone': '9', 'attendance': 85, 'perfGrade': 'A2', 'grade': '10'},
    {'id': 'stu_101', 'name': 'Aarav Sharma', 'grn': 'GIS-9200', 'classId': 'cls_10B', 'roll': 1, 'guardian': 'Mr. Sharma', 'phone': '8', 'attendance': 75, 'perfGrade': 'A1', 'grade': '10'},
  ],
  'ops_periods': [
    {'id': 'per_10B_Wed_3', 'classId': 'cls_10B', 'grade': '10', 'section': 'B', 'day': 'Wed', 'period': 3, 'subject': 'Mathematics', 'teacherId': 'stf_025', 'room': 'Room 204'},
  ],
  'ops_substitutions': [
    {'id': 'sub_1', 'date': '2026-10-26', 'day': 'Mon', 'period': 5, 'classId': 'cls_8C', 'subject': 'Physics', 'absentTeacherId': 'stf_003', 'substituteTeacherId': 'stf_025', 'status': 'Assigned', 'topic': 'Friction', 'note': 'Goggles'},
    {'id': 'sub_old', 'date': '2026-09-01', 'day': 'Tue', 'period': 2, 'classId': 'cls_8C', 'subject': 'Physics', 'absentTeacherId': 'stf_003', 'substituteTeacherId': 'stf_025', 'status': 'Accepted'},
  ],
  'com_notices': [
    {'id': 'ntc_006', 'title': 'Staff Meeting', 'category': 'Staff', 'audience': 'Staff & Teachers', 'status': 'Published', 'sentAt': '2026-10-26T15:30:00+05:30', 'author': 'Principal', 'body': 'At 3:30', 'pinned': false},
    {'id': 'ntc_001', 'title': 'Fog', 'category': 'Campus Safety & Transport', 'audience': 'All Parents & Bus Drivers', 'status': 'Published', 'sentAt': '2026-10-14T06:30:00+05:30'},
  ],
  'att_circulars': [
    {'id': 'ntc_006', 'teacherId': 'stf_025', 'read': true, 'pinned': true},
  ],
};

void main() {
  group('adapter helpers', () {
    test('class ids map legacy to contract', () {
      expect(remoteClassId('c_10b'), 'cls_10B');
      expect(remoteClassId('c_8c'), 'cls_8C');
      expect(remoteClassId('cls_9A'), 'cls_9A');
      expect(classLabelOf('cls_10B'), '10-B');
      expect(gradeSectionOf('c_9a').grade, '9');
    });
    test('day and period conversion', () {
      expect(dayNumber('Mon'), 1);
      expect(dayNumber('Sat'), 6);
      expect(dayName(3), 'Wed');
      expect(slotOf(3), 'P3');
      expect(periodOf('P6'), 6);
    });
    test('whereIn queries are chunked by 30', () {
      final q = inQueries('students', 'classId', [for (var i = 0; i < 65; i++) 'c$i']);
      expect(q.length, 3);
      expect(q.first.inValues.length, 30);
    });
  });

  group('adapters (fake data)', () {
    test('me = staff + school', () {
      final me = const MeAdapter().build(ctx, fake).single;
      expect(me['name'], 'Mrs. Anita Sharma');
      expect(me['short'], 'Anita');
      expect(me['school'], 'Greenfield International School');
      expect(me['year'], 'AY 2026-27');
      expect(me['term'], 'Term 2');
      expect(me['empId'], 'EMP-2041');
    });
    test('me profile edits are a private overlay', () {
      final w = const MeAdapter().write(ctx, fake, {'id': 'me', 'name': 'Anita S.', 'email': 'n@x', 'phone': '2', 'school': 'ignored'}).single;
      expect(w.collection, 'me');
      expect(w.id, 'stf_025');
      expect(w.data['name'], 'Anita S.');
      expect(w.data['teacherId'], 'stf_025');
      expect(w.data.containsKey('school'), isFalse);
      final over = {...fake, 'me': [{'id': 'stf_025', 'teacherId': 'stf_025', 'name': 'Anita S.'}]};
      expect(const MeAdapter().build(ctx, over).single['name'], 'Anita S.');
    });
    test('classes: only the teacher\'s, with subject, topic and class teacher flag', () {
      final rows = const ClassesAdapter().build(ctx, fake);
      expect(rows.map((r) => r['id']), ['cls_10B', 'cls_8C']);
      expect(rows.first['subject'], 'Mathematics');
      expect(rows.first['topic'], 'Coordinate Geometry');
      expect(rows.first['classTeacher'], true);
      expect(rows.first['students'], 42);
      expect(rows.first['attendance'], 80.0);
      expect(rows.last['classTeacher'], false);
      expect(const ClassesAdapter().readOnly, isTrue);
    });
    test('students query follows the teacher\'s class ids, rows sorted by roll, letter grade not in grade', () {
      final q = const StudentsAdapter().queries(ctx, fake).single;
      expect(q.inField, 'classId');
      expect(q.inValues, ['cls_10B', 'cls_8C']);
      final rows = const StudentsAdapter().build(ctx, fake);
      expect(rows.map((r) => r['id']), ['stu_101', 'stu_102']);
      expect(rows.first['adm'], 'GIS-9200');
      expect(rows.first['grade'], 'A1');
    });
    test('timetable: Mon..Sat to 1..6, period to P#, this week substitutions only', () {
      final rows = const PeriodsAdapter().build(ctx, fake);
      final core = rows.firstWhere((r) => r['kind'] == 'core');
      expect(core['day'], 3);
      expect(core['slot'], 'P3');
      expect(core['label'], '10-B');
      expect(core['topic'], 'Coordinate Geometry');
      final subs = rows.where((r) => r['kind'] == 'sub').toList();
      expect(subs.length, 1);
      expect(subs.single['day'], 1);
      expect(subs.single['slot'], 'P5');
      expect(subs.single['subId'], 'sub_1');
    });
    test('substitutions: status words, faculty name and overlay checklist', () {
      final over = {...fake, 'tt_subs': [{'id': 'sub_1', 'teacherId': 'stf_025', 'tasks': [{'t': 'Roll call', 's': '', 'done': true}]}]};
      final rows = const SubstitutionsAdapter().build(ctx, over);
      final s = rows.firstWhere((r) => r['id'] == 'sub_1');
      expect(s['status'], 'pending');
      expect(s['faculty'], 'Dr. Myra Sharma');
      expect(s['classLabel'], '8-C Physics');
      expect((s['tasks'] as List).length, 1);
      expect(rows.firstWhere((r) => r['id'] == 'sub_old')['status'], 'accepted');
      final w = const SubstitutionsAdapter().write(ctx, over, {...s, 'status': 'declined'});
      expect(w.first.collection, 'ops_substitutions');
      expect(w.first.data['status'], 'Declined');
    });
    test('attendance id, class/grade/section and marks', () {
      final row = {'classId': 'c_10b', 'date': '2026-10-26', 'period': 3, 'total': 42, 'marks': {'stu_101': 'A'}, 'submitted': true};
      expect(const AttendanceAdapter().newId(ctx, row), '2026-10-26_cls_10B_3');
      final w = const AttendanceAdapter().write(ctx, fake, {...row, 'id': '2026-10-26_cls_10B_3'}).single;
      expect(w.collection, 'ops_attendance');
      expect(w.id, '2026-10-26_cls_10B_3');
      expect(w.data['grade'], '10');
      expect(w.data['section'], 'B');
      expect(w.data['teacherId'], 'stf_025');
      expect(w.data['marks'], {'stu_101': 'A'});
      final back = const AttendanceAdapter().build(ctx, {'ops_attendance': [w.data..['id'] = w.id]}).single;
      expect(back['classId'], 'cls_10B');
      expect(back['marks'], {'stu_101': 'A'});
    });
    test('homework gets the denormalized admin fields', () {
      final hw = {
        'id': 'hw_x', 'classId': 'cls_10A', 'title': 'Quadratics', 'subject': 'Mathematics', 'due': '2026-10-30', 'maxMarks': 20, 'description': '', 'status': 'open',
        'createdAt': '2026-10-26T09:00:00', 'submissions': {'a': {'status': 'graded'}, 'b': {'status': 'submitted'}, 'c': {'status': 'pending'}},
      };
      final d = const HomeworkAdapter().write(ctx, fake, hw).single.data;
      expect(d['teacherId'], 'stf_025');
      expect(d['teacher'], 'Mrs. Anita Sharma');
      expect(d['grade'], '10');
      expect(d['section'], 'A');
      expect(d['assigned'], '2026-10-26');
      expect(d['submitted'], 2);
      expect(d['total'], 3);
      final back = const HomeworkAdapter().build(ctx, {'ops_homework': [{...d, 'id': 'hw_x'}]}).single;
      expect(back['classId'], 'cls_10A');
      expect(back.containsKey('teacher'), isFalse);
      expect(back['title'], 'Quadratics');
    });
    test('homework created in the admin web shows in the teacher app (open, one pending entry per student)', () {
      final rows = const HomeworkAdapter().build(ctx, {
        ...fake,
        'ops_homework': [
          {'id': 'hw_6', 'title': 'Distance Formula', 'classId': 'cls_10B', 'teacherId': 'stf_025', 'subject': 'Mathematics', 'due': '2026-10-28', 'assigned': '2026-10-22', 'status': 'Published', 'submitted': 31, 'total': 42},
        ],
      });
      final hw = rows.single;
      expect(hw['status'], 'open');
      expect(hw['maxMarks'], 20);
      expect(hw['createdAt'], startsWith('2026-10-22'));
      expect((hw['submissions'] as Map).keys, containsAll(['stu_101', 'stu_102']));
      expect(HomeworkAdapter.localStatus('Completed'), 'closed');
    });
    test('marks map to exm_marks ids and fields (exam id = paper@class)', () {
      final w = const MarksAdapter().write(ctx, fake, {'id': 'pap_1@cls_10B_stu_101', 'examId': 'pap_1@cls_10B', 'studentId': 'stu_101', 'status': 'Present', 'marks': 41, 'tag': 'Consistent', 'note': ''}).single;
      expect(w.collection, 'exm_marks');
      expect(w.id, 'pap_1__cand_stu_101');
      expect(w.data['paperId'], 'pap_1');
      expect(w.data['classId'], 'cls_10B');
      expect(w.data['candId'], 'cand_stu_101');
      expect(w.data['theory'], 41);
      expect(w.data.containsKey('internal'), isFalse); // admin-owned fields are never overwritten
      expect(w.data.containsKey('verified'), isFalse);
      final back = const MarksAdapter().build(ctx, {'exm_marks': [{...w.data, 'id': w.id}]}).single;
      expect(back['id'], 'pap_1@cls_10B_stu_101');
      expect(back['examId'], 'pap_1@cls_10B');
      expect(back['marks'], 41);
      // marks entered before classId was stored: the class comes from the student
      final legacy = const MarksAdapter().build(ctx, {...fake, 'exm_marks': [{...w.data..remove('classId'), 'id': w.id}]}).single;
      expect(legacy['examId'], 'pap_1@cls_10B');
    });
    test('exams come from admin papers for the classes and subjects the teacher teaches', () {
      final remote = {
        ...fake,
        'exm_cycles': [{'id': 'cyc_2', 'short': 'Term 2 Pre-Board'}],
        'exm_papers': [
          {'id': 'pap_m10', 'cycleId': 'cyc_2', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'date': '2026-11-18', 'classIds': ['cls_10A', 'cls_10B']},
          {'id': 'pap_s8', 'cycleId': 'cyc_2', 'grade': '8', 'subject': 'Science', 'theory': 80, 'date': '2026-11-21'},
          {'id': 'pap_e8', 'cycleId': 'cyc_2', 'grade': '8', 'subject': 'English Lang & Lit', 'theory': 80, 'date': '2026-11-28'},
          {'id': 'pap_m10p', 'cycleId': 'cyc_2', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'date': '2026-11-01', 'classIds': ['cls_10B'], 'published': ['10-B']},
          {'id': 'pap_m10o', 'cycleId': 'cyc_2', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'date': '2026-11-02', 'classIds': ['cls_10B'], 'published': ['10-A']},
          {'id': 'pap_m10l', 'cycleId': 'cyc_2', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'date': '2026-11-03', 'classIds': ['cls_10B'], 'locked': true},
        ],
        'att_exam_state': [{'id': 'pap_s8@cls_8C', 'status': 'Submitted', 'submittedAt': '2026-11-22', 'teacherId': 'stf_025'}],
      };
      final rows = const ExamsAdapter().build(ctx, remote);
      expect(rows.map((r) => r['id']).toSet(), {'pap_s8@cls_8C', 'pap_m10@cls_10B', 'pap_m10p@cls_10B', 'pap_m10o@cls_10B', 'pap_m10l@cls_10B'});
      final m = rows.firstWhere((r) => r['id'] == 'pap_m10@cls_10B');
      expect(m['name'], 'Term 2 Pre-Board');
      expect(m['max'], 80);
      expect(m['status'], 'Draft');
      expect(rows.firstWhere((r) => r['id'] == 'pap_s8@cls_8C')['status'], 'Submitted'); // Physics teacher, Science paper, no classIds -> grade 8
      expect(rows.firstWhere((r) => r['id'] == 'pap_m10p@cls_10B')['status'], 'Locked'); // results published -> read only
      expect(rows.firstWhere((r) => r['id'] == 'pap_m10o@cls_10B')['status'], 'Draft'); // another class published: still open
      expect(rows.firstWhere((r) => r['id'] == 'pap_m10l@cls_10B')['status'], 'Locked'); // marks window locked
      final w = const ExamsAdapter().write(ctx, remote, {...m, 'status': 'Submitted', 'submittedAt': '2026-11-19'}).single;
      expect(w.collection, 'att_exam_state');
      expect(w.id, 'pap_m10@cls_10B');
      expect(w.data['teacherId'], 'stf_025');
      expect(subjectCovers('Science', 'Physics'), isTrue);
      expect(subjectCovers('English Lang & Lit', 'Physics'), isFalse);
      expect(subjectCovers('Social Science', 'Physics'), isFalse);
      expect(subjectCovers('Computer Applications', 'Science'), isFalse);
    });
    test('Apply Leave (att_leaves) and Leave Management (lm_my) share staff_leaves; quota counts approved days', () {
      final w = const StaffLeavesAdapter('att_leaves').write(ctx, fake, {'id': 'att_1', 'type': 'Casual Leave', 'start': '2026-10-29', 'end': '2026-10-31', 'days': 3, 'reason': 'Family function', 'status': 'Pending', 'handovers': const []}).single;
      expect(w.collection, 'staff_leaves');
      expect(w.data['from'], '2026-10-29');
      expect(w.data['to'], '2026-10-31');
      expect(w.data['staffId'], 'stf_025');
      final remote = {'staff_leaves': [{...w.data, 'id': 'att_1'}, {'id': 'lm_1', 'staffId': 'stf_025', 'type': 'Casual Leave', 'from': '2026-09-01', 'to': '2026-09-02', 'days': 2, 'status': 'Approved'}]};
      final att = const StaffLeavesAdapter('att_leaves').build(ctx, remote);
      expect(att.map((r) => r['id']), containsAll(['att_1', 'lm_1']));
      expect(att.firstWhere((r) => r['id'] == 'lm_1')['start'], '2026-09-01');
      expect(att.firstWhere((r) => r['id'] == 'lm_1')['by'], 'School Admin');
      expect(const StaffLeavesAdapter().build(ctx, remote).firstWhere((r) => r['id'] == 'att_1')['from'], '2026-10-29');
      final cl = const LeaveQuotaAdapter().build(ctx, remote).firstWhere((q) => q['id'] == 'CL');
      expect(cl['total'], 12);
      expect(cl['used'], 2); // only the approved one
      expect(const LeaveBalanceAdapter().build(ctx, remote).map((b) => b['type']), contains('Medical Leave'));
    });
    test('staff leave writes only staff_leaves (admin web mirrors it into approvals)', () {
      final w = const StaffLeavesAdapter().write(ctx, fake, {'id': 'l1', 'type': 'Casual Leave', 'from': '2026-11-02', 'to': '2026-11-02', 'days': 1, 'reason': 'Family', 'status': 'Pending'});
      expect(w.map((e) => e.collection), ['staff_leaves']);
      expect(w.single.data['staffId'], 'stf_025');
      expect(w.single.data['status'], 'Pending');
      expect(w.single.data['createdAt'], isNotEmpty);
    });
    test('live class write/read with join count', () {
      final row = {'id': 'lc1', 'title': 'Algebra', 'classId': 'cls_10B', 'subject': 'Mathematics', 'date': '2026-10-27', 'time': '10:00', 'mins': 45, 'medium': 'Google Meet', 'link': 'https://meet.google.com/abc-defg-hij', 'status': 'upcoming', 'joined': 3};
      final w = const LiveClassesAdapter().write(ctx, fake, row).single;
      expect(w.collection, 'live_classes');
      expect(w.data['teacherId'], 'stf_025');
      expect(w.data.containsKey('joined'), isFalse);
      expect(w.data['createdAt'], isNotNull);
      final remote = {'live_classes': [{...w.data, 'id': 'lc1'}], 'live_class_joins': [{'id': 'lc1', 'count': 5}]};
      final back = const LiveClassesAdapter().build(ctx, remote).single;
      expect(back['joined'], 5);
      expect(back['classId'], 'cls_10B');
    });
    test('circulars: staff audience only, read state from private overlay', () {
      final rows = const CircularsAdapter().build(ctx, fake);
      expect(rows.length, 1);
      expect(rows.single['id'], 'ntc_006');
      expect(rows.single['read'], true);
      expect(rows.single['pinned'], true);
      expect(rows.single['cat'], 'Admin');
      expect(rows.single['date'], '2026-10-26');
      final w = const CircularsAdapter().write(ctx, fake, {...rows.single, 'ack': true}).single;
      expect(w.collection, 'att_circulars');
      expect(w.data['ack'], true);
      expect(w.data.containsKey('title'), isFalse);
    });
    test('settings are one document per teacher (hm_settings/settings_{staffId})', () {
      const a = PrivateAdapter('settings', 'hm_settings');
      final w = a.write(ctx, fake, {'id': 'settings', 'classUpdates': false, 'dnd': true}).single;
      expect(w.collection, 'hm_settings');
      expect(w.id, 'settings_stf_025');
      expect(w.data['teacherId'], 'stf_025');
      final back = a.build(ctx, {'hm_settings': [{...w.data, 'id': w.id}, {'id': 'settings_stf_003', 'teacherId': 'stf_003', 'classUpdates': true}]});
      expect(back.single['id'], 'settings');
      expect(back.single['classUpdates'], isFalse);
    });
    test('private collections carry teacherId and keep newest first', () {
      const a = PrivateAdapter('tk_tasks');
      final w = a.write(ctx, fake, {'id': 't1', 'title': 'x', 'ord': 5}).single;
      expect(w.data['teacherId'], 'stf_025');
      expect(w.data.containsKey('id'), isFalse);
      final rows = a.build(ctx, {
        'tk_tasks': [
          {'id': 'old', 'teacherId': 'stf_025', 'ord': 1},
          {'id': 'new', 'teacherId': 'stf_025', 'ord': 9},
          {'id': 'other', 'teacherId': 'stf_999', 'ord': 99},
        ]
      });
      expect(rows.map((r) => r['id']), ['new', 'old']);
    });
  });

  group('staff check-in, leave policy, exam duties (§12)', () {
    test('punch in creates staff_attendance/{date}_{staffId}; Late from the policy checkInBy (default 08:15)', () {
      const a = StaffAttendanceAdapter();
      final row = {'id': 'sl_2026-10-26', 'date': '2026-10-26', 'in': '08:20', 'out': null, 'status': 'Present', 'note': 'Gate'};
      expect(a.newId(ctx, row), '2026-10-26_stf_025');
      final w = a.write(ctx, const {}, row).single;
      expect((w.collection, w.id), ('staff_attendance', '2026-10-26_stf_025'));
      expect(w.data, containsPair('status', 'Late'));
      expect(w.data['staffId'], 'stf_025');
      expect(w.data['teacherId'], 'stf_025');
      expect(w.data['source'], 'app');
      final policy = {'set_leave_policy': [{'id': 'policy', 'checkInBy': '08:30'}]};
      expect(a.write(ctx, policy, row).single.data['status'], 'Present');
      expect(a.write(ctx, const {}, {...row, 'in': '08:15'}).single.data['status'], 'Present');
    });
    test('punch out writes only out; admin-corrected days read back with the remote id', () {
      const a = StaffAttendanceAdapter();
      final remote = {
        'staff_attendance': [
          {'id': '2026-10-26_stf_025', 'staffId': 'stf_025', 'date': '2026-10-26', 'in': '08:40', 'out': null, 'status': 'Present', 'note': 'Fixed', 'source': 'admin'},
          {'id': '2026-10-23_stf_025', 'staffId': 'stf_025', 'date': '2026-10-23', 'in': '08:00', 'out': '16:30', 'status': 'Present'},
          {'id': '2026-10-26_stf_003', 'staffId': 'stf_003', 'date': '2026-10-26', 'in': '08:00', 'status': 'Present'},
        ]
      };
      final rows = a.build(ctx, remote);
      expect(rows.map((r) => r['id']), ['2026-10-26_stf_025', '2026-10-23_stf_025']);
      expect(rows.first['in'], '08:40');
      final w = a.write(ctx, remote, {...rows.first, 'out': '16:35'}).single;
      expect(w.id, '2026-10-26_stf_025');
      expect(w.data.keys.where((k) => !const ['teacherId', 'updatedAt', 'updatedBy'].contains(k)), ['out']);
      expect(w.data['out'], '16:35');
    });
    test('regularizations: created Pending, decision read back, decided requests are read-only', () {
      const a = RegularizationsAdapter();
      final w = a.write(ctx, const {}, {'id': 'reg1', 'date': '2026-10-22', 'type': 'Check-in', 'time': '08:05', 'reason': 'Biometric down', 'note': 'Gate 2', 'status': 'Approved', 'at': '2026-10-22T10:00:00'}).single;
      expect((w.collection, w.id), ('staff_regularizations', 'reg1'));
      expect(w.data['status'], 'Pending');
      expect(w.data['staffId'], 'stf_025');
      final remote = {
        'staff_regularizations': [
          {...w.data, 'id': 'reg1', 'status': 'Rejected', 'decisionNote': 'No CCTV record', 'decidedBy': 'uid_admin', 'decidedAt': '2026-10-23T09:00:00'},
          {'id': 'reg2', 'staffId': 'stf_025', 'date': '2026-10-24', 'type': 'Check-out', 'time': '16:30', 'reason': 'Field trip', 'status': 'Pending', 'at': '2026-10-24T17:00:00'},
          {'id': 'reg3', 'staffId': 'stf_003', 'date': '2026-10-24', 'status': 'Pending'},
        ]
      };
      final rows = a.build(ctx, remote);
      expect(rows.map((r) => r['id']), ['reg2', 'reg1']);
      final r1 = rows.last;
      expect((r1['status'], r1['decisionNote'], r1['note']), ('Rejected', 'No CCTV record', 'Gate 2'));
      expect(a.write(ctx, remote, r1), isEmpty);
      expect(a.write(ctx, remote, rows.first), hasLength(1));
    });
    test('leave quotas come from set_leave_policy/policy, built-in defaults when it is missing', () {
      final leaves = [
        {'id': 'l1', 'staffId': 'stf_025', 'type': 'Casual Leave', 'days': 2, 'status': 'Approved'},
        {'id': 'l2', 'staffId': 'stf_025', 'type': 'Earned Leave', 'days': 3, 'status': 'Completed'},
        {'id': 'l3', 'staffId': 'stf_025', 'type': 'Earned Leave', 'days': 1, 'status': 'Pending'},
      ];
      expect(const LeaveQuotaAdapter().queries(ctx, const {}).map((q) => q.collection), contains('set_leave_policy'));
      expect(const LeaveBalanceAdapter().queries(ctx, const {}).single.eq, {'__name__': 'policy'});
      final none = {'staff_leaves': leaves};
      expect(const LeaveQuotaAdapter().build(ctx, none).map((q) => q['id']), ['CL', 'ML', 'DL']);
      expect(const LeaveBalanceAdapter().build(ctx, none).length, kLeavePolicy.length - 1);
      final remote = {
        'staff_leaves': leaves,
        'set_leave_policy': [
          {'id': 'policy', 'checkInBy': '08:15', 'types': [
            {'id': 'CL', 'name': 'Casual (CL)', 'type': 'Casual Leave', 'total': 8},
            {'id': 'EL', 'name': 'Earned (EL)', 'type': 'Earned Leave', 'total': 15},
          ]},
        ],
      };
      final q = const LeaveQuotaAdapter().build(ctx, remote);
      expect(q.map((r) => (r['id'], r['total'], r['used'])), [('CL', 8, 2), ('EL', 15, 3)]);
      expect(const LeaveBalanceAdapter().build(ctx, remote), [
        {'id': 'lb_CL', 'type': 'Casual Leave', 'total': 8},
        {'id': 'lb_EL', 'type': 'Earned Leave', 'total': 15},
      ]);
      expect(checkInBy(remote), '08:15');
      expect(checkInBy(const {}), kCheckInBy);
    });

    final Remote exams = {
      'staff': [
        {'id': 'stf_025', 'name': 'Mrs. Anita Sharma'},
        {'id': 'stf_003', 'name': 'Dr. Myra Sharma', 'designation': 'PGT Physics'},
        {'id': 'stf_007', 'name': 'Mr. Ramesh Gupta', 'department': 'English'},
      ],
      'exm_cycles': [{'id': 'cyc_2', 'title': 'Term 2 Pre-Board Examinations', 'short': 'Term 2 Pre-Board'}],
      'exm_papers': [
        {'id': 'pap_m10', 'cycleId': 'cyc_2', 'grade': '10', 'subject': 'Mathematics', 'code': 'MATH-041', 'date': '2026-11-18', 'start': '09:00', 'duration': 2.5, 'venue': 'Exam Hall 4', 'classIds': ['cls_10A', 'cls_10B'], 'invigilatorId': 'stf_003'},
        {'id': 'pap_s9', 'cycleId': 'cyc_2', 'grade': '9', 'subject': 'Science', 'code': 'SCI-086', 'date': '2026-10-20', 'start': '10:00', 'duration': 2, 'venue': 'Hall 6', 'invigilatorId': 'stf_025'},
        {'id': 'pap_e8', 'cycleId': 'cyc_2', 'grade': '8', 'subject': 'English', 'code': 'ENG-184', 'date': '2026-11-28', 'start': '09:00', 'venue': 'Hall 1', 'invigilatorId': 'stf_007'},
      ],
      'exm_duties': [
        {'id': 'dut_1', 'paperId': 'pap_m10', 'cycleId': 'cyc_2', 'staffId': 'stf_025', 'role': 'Invigilator', 'hall': 'Exam Hall 4', 'venue': 'Block B • Floor 2', 'date': '2026-11-18', 'start': '09:00', 'end': '11:30', 'grade': '10', 'subject': 'Mathematics', 'code': 'MATH-041', 'classIds': ['cls_10A', 'cls_10B'], 'candidates': 40, 'status': 'upcoming', 'reportBy': '08:20'},
        {'id': 'dut_2', 'paperId': 'pap_m10', 'staffId': 'stf_003', 'role': 'Chief Invigilator', 'hall': 'Exam Hall 4', 'date': '2026-11-18', 'start': '09:00'},
        {'id': 'dut_3', 'paperId': 'pap_m10', 'staffId': 'stf_007', 'role': 'Invigilator', 'hall': 'Exam Hall 5', 'date': '2026-11-18', 'start': '09:00'},
        {'id': 'dut_4', 'paperId': 'pap_e8', 'staffId': 'stf_025', 'role': 'Reliever', 'hall': 'Hall 1', 'date': '2026-11-28', 'start': '09:00', 'deleted': true},
      ],
      'exm_candidates': [
        {'id': 'cand_stu_102', 'studentId': 'stu_102', 'name': 'Ananya Reddy', 'roll': '#10B-02', 'grn': 'GIS-9201', 'cls': '10-B', 'grade': '10', 'section': 'B'},
        {'id': 'cand_stu_101', 'studentId': 'stu_101', 'name': 'Aarav Sharma', 'roll': '#10B-01', 'grn': 'GIS-9200', 'cls': '10-B', 'grade': '10', 'section': 'B'},
        {'id': 'cand_stu_050', 'studentId': 'stu_050', 'name': 'Kabir Rao', 'roll': 3, 'grn': 'GIS-9100', 'cls': '10-A', 'grade': '10', 'section': 'A'},
        {'id': 'cand_stu_201', 'studentId': 'stu_201', 'name': 'Isha Nair', 'roll': 1, 'grn': 'GIS-9300', 'cls': '9-A', 'grade': '9', 'section': 'A'},
      ],
      'ed_duty_state': [
        {'id': 'dut_1_stf_025', 'teacherId': 'stf_025', 'dutyId': 'dut_1', 'swap': 'requested', 'swapWith': 'Mr. Ramesh Gupta', 'swapReason': 'Clash', 'checked': [0, 2]},
      ],
      'ed_cand_state': [
        {'id': 'dut_1__cand_stu_102_stf_025', 'teacherId': 'stf_025', 'status': 'absent', 'absentReason': 'Fever', 'supp': 1, 'suppCode': 'SUP-4491'},
      ],
    };

    test('exam duties: own exm_duties + chief papers without a row, partner from the same paper and hall, overlay state', () {
      final rows = const ExamDutiesAdapter().build(ctx, exams);
      expect(rows.map((r) => r['id']), ['chief_pap_s9', 'dut_1']); // date order; deleted duty skipped
      final d = ExamDuty.fromJson(rows.last);
      expect((d.code, d.subject, d.sub, d.date, d.start, d.end), ('MATH-041', 'Mathematics — Class 10', 'Term 2 Pre-Board', '2026-11-18', '09:00', '11:30'));
      expect((d.hall, d.venue, d.role, d.report, d.cls, d.candidates), ('Exam Hall 4', 'Block B • Floor 2', 'Invigilator', '08:20', 'Class 10-A, 10-B', 40));
      expect((d.partner, d.partnerRole), ('Dr. Myra Sharma', 'Chief Invigilator • PGT Physics')); // not Mr. Gupta (other hall)
      expect((d.status, d.swap, d.swapWith, d.submitted), ('upcoming', 'requested', 'Mr. Ramesh Gupta', false));
      expect(d.checked, [0, 2]);
      final c = ExamDuty.fromJson(rows.first);
      expect((c.role, c.hall, c.partner, c.partnerRole, c.status), ('Chief Invigilator', 'Hall 6', 'Self', 'Lead Chief Invigilator', 'completed'));
      expect((c.end, c.report, c.cls, c.candidates, c.venue), ('12:00', '09:30', 'Class 9', 1, 'Class 9 • Hall 6'));
    });
    test('exam duties: queries cover duties, partners, papers, staff, candidates and the overlay; writes only the overlay', () {
      final keys = const ExamDutiesAdapter().queries(ctx, exams).map((q) => q.key).toList();
      expect(keys, containsAll([
        RemoteQuery('exm_duties', eq: {'staffId': 'stf_025'}).key, const RemoteQuery('exm_papers').key, const RemoteQuery('staff').key,
        const RemoteQuery('exm_duties', inField: 'paperId', inValues: ['pap_m10', 'pap_s9']).key,
        const RemoteQuery('exm_candidates', inField: 'cls', inValues: ['10-A', '10-B']).key,
        const RemoteQuery('exm_candidates', inField: 'grade', inValues: ['9']).key,
        RemoteQuery('ed_duty_state', eq: {'teacherId': 'stf_025'}).key,
      ]));
      final row = const ExamDutiesAdapter().build(ctx, exams).last;
      final w = const ExamDutiesAdapter().write(ctx, exams, {...row, 'submitted': true, 'checked': [0, 1, 2]}).single;
      expect((w.collection, w.id), ('ed_duty_state', 'dut_1_stf_025'));
      expect(w.data, allOf(containsPair('submitted', true), containsPair('teacherId', 'stf_025'), containsPair('dutyId', 'dut_1')));
      expect(w.data.containsKey('hall'), isFalse);
    });
    test('exam candidates: paper classes in roll order, desks D-01.., set A/B, cbse = grn, overlay state', () {
      final rows = const ExamCandidatesAdapter().build(ctx, exams);
      final m10 = [for (final r in rows) if (r['dutyId'] == 'dut_1') Candidate.fromJson(r)];
      expect(m10.map((c) => c.name), ['Kabir Rao', 'Aarav Sharma', 'Ananya Reddy']);
      expect(m10.map((c) => c.desk), ['D-01', 'D-02', 'D-03']);
      expect(m10.map((c) => c.set), ['A', 'B', 'A']);
      expect((m10[1].roll, m10[1].cls, m10[1].cbse, m10[1].omr, m10[1].status), (1, '10-B', 'GIS-9200', 'MATH041-002', 'present'));
      expect((m10[2].status, m10[2].absentReason, m10[2].supp, m10[2].suppCode), ('absent', 'Fever', 1, 'SUP-4491'));
      expect(rows.where((r) => r['dutyId'] == 'chief_pap_s9').map((r) => r['name']), ['Isha Nair']); // no classIds: whole grade
      final w = const ExamCandidatesAdapter().write(ctx, exams, {...rows.first, 'malpractice': 'Passed a note'}).single;
      expect((w.collection, w.id), ('ed_cand_state', 'dut_1__cand_stu_050_stf_025'));
      expect(w.data, allOf(containsPair('malpractice', 'Passed a note'), containsPair('candId', 'cand_stu_050'), containsPair('status', 'present')));
      expect(w.data.containsKey('name'), isFalse);
    });
  });

  group('FirestoreDataStore (fake gateway)', () {
    late FakeGateway gw;
    late FirestoreDataStore store;
    setUp(() {
      gw = FakeGateway();
      store = FirestoreDataStore(gw);
    });
    tearDown(() => store.stop());

    Future<void> pump() => Future<void>.delayed(Duration.zero);

    test('reads are empty before start, then fill from snapshots', () async {
      expect(store.list('classes'), isEmpty);
      store.start(ctx);
      await pump();
      expect(store.list('classes'), isEmpty);
      gw.load(fake);
      await pump();
      await pump();
      expect(store.list('classes').map((r) => r['id']), ['cls_10B', 'cls_8C']);
      expect(store.list('students').length, 2); // second phase query (whereIn) started after classes arrived
      expect(store.doc('me')['name'], 'Mrs. Anita Sharma');
      expect(gw.bound, 's1');
    });

    test('a watcher registered before login (global BLoCs) still sees the timetable', () async {
      var fired = 0;
      final sub = store.watch({'tt_periods', 'tt_subs'}).listen((_) => fired++);
      store.start(ctx);
      await pump();
      gw.load(fake);
      await pump();
      await pump();
      expect(store.list('tt_periods').where((r) => r['kind'] == 'core'), isNotEmpty);
      expect(fired, greaterThan(0));
      await sub.cancel();
    });

    test('writes are optimistic and write through; private rows keep teacherId', () async {
      store.start(ctx);
      gw.load(fake);
      await pump();
      final added = store.add('tk_tasks', {'title': 'Mark tests'});
      expect(store.byId('tk_tasks', added['id'] as String)!['title'], 'Mark tests');
      expect(gw.writes.last.collection, 'tk_tasks');
      expect(gw.writes.last.data['teacherId'], 'stf_025');
      store.update('tk_tasks', added['id'] as String, {'title': 'Mark papers'});
      expect(store.list('tk_tasks').single['title'], 'Mark papers');
      expect(store.remove('tk_tasks', added['id'] as String), isTrue);
      expect(store.list('tk_tasks'), isEmpty);
      expect(gw.writes.last.delete, isTrue);
    });

    test('attendance save creates the contract id', () async {
      store.start(ctx);
      gw.load(fake);
      await pump();
      final r = store.add('att_records', {'classId': 'cls_10B', 'date': '2026-10-26', 'period': 1, 'total': 42, 'marks': <String, dynamic>{}, 'submitted': true});
      expect(r['id'], '2026-10-26_cls_10B_1');
      expect(gw.writes.last.collection, 'ops_attendance');
      store.update('att_records', r['id'] as String, {'marks': {'stu_101': 'L'}});
      expect(store.byId('att_records', r['id'] as String)!['marks'], {'stu_101': 'L'});
    });

    test('punch in with a local id keeps one remote doc per day; punch out updates it', () async {
      store.start(ctx);
      gw.load(fake);
      await pump();
      store.add('att_staff', {'id': 'sl_2026-10-26', 'date': '2026-10-26', 'in': '08:05', 'out': null, 'status': 'Present', 'note': ''});
      expect((gw.writes.last.collection, gw.writes.last.id), ('staff_attendance', '2026-10-26_stf_025'));
      final today = store.list('att_staff').single;
      expect(today['id'], '2026-10-26_stf_025');
      store.update('att_staff', today['id'] as String, {'out': '16:30'});
      expect(gw.writes.last.id, '2026-10-26_stf_025');
      expect(gw.writes.last.data.containsKey('in'), isFalse);
      expect(store.list('att_staff').single['out'], '16:30');
    });

    test('read-only master data ignores writes', () async {
      final errors = <Object>[];
      store = FirestoreDataStore(gw, onError: (e, s) => errors.add(e));
      store.start(ctx);
      gw.load(fake);
      await pump();
      store.update('classes', 'cls_10B', {'room': 'x'});
      expect(store.byId('classes', 'cls_10B')!['room'], 'Room 204');
      expect(errors, isNotEmpty);
      expect(gw.writes, isEmpty);
    });

    test('changes stream announces rebuilt collections; join writes a join doc and counts it', () async {
      store.start(ctx);
      final changed = <String>[];
      store.changes.listen(changed.add);
      gw.load(fake);
      gw.load({'live_classes': [{'id': 'lc1', 'teacherId': 'stf_025', 'title': 'Algebra', 'classId': 'cls_10B', 'date': '2026-10-27', 'time': '10:00', 'mins': 45, 'status': 'upcoming'}]});
      await pump();
      store.list('lv_sessions');
      await pump();
      expect(changed, contains('classes'));
      await store.recordJoin('lc1');
      expect(gw.joins.single, ('live_classes', 'lc1', 'joins', 'uid1'));
      expect(store.list('lv_sessions').single['joined'], 1);
    });

    test('stop clears everything', () async {
      store.start(ctx);
      gw.load(fake);
      await pump();
      store.stop();
      expect(store.list('classes'), isEmpty);
      expect(gw.activeListeners, 0);
    });
  });
}

/// In-memory gateway: [load] pushes docs to every matching listener (filters honoured like Firestore would).
class FakeGateway implements RemoteGateway {
  String? bound;
  final Map<RemoteQuery, StreamController<List<Rec>>> _ctrls = {};
  final Map<String, List<Rec>> _data = {};
  final List<RemoteWrite> writes = [];
  final List<(String, String, String, String)> joins = [];

  int get activeListeners => _ctrls.values.where((c) => c.hasListener).length;

  void load(Remote data) {
    data.forEach((c, docs) => _data[c] = [...?_data[c], ...docs]);
    for (final e in _ctrls.entries) {
      if (data.containsKey(e.key.collection)) e.value.add(_match(e.key));
    }
  }

  List<Rec> _match(RemoteQuery q) => [
        for (final d in _data[q.collection] ?? const <Rec>[])
          if (q.eq.entries.every((e) => (e.key == '__name__' ? d['id'] : d[e.key]) == e.value) &&
              (q.inField == null || q.inValues.contains(q.inField == '__name__' ? d['id'] : d[q.inField!])))
            d
      ];

  @override
  void bind(String schoolId) => bound = schoolId;

  @override
  Stream<List<Rec>> watch(RemoteQuery query) {
    late StreamController<List<Rec>> c;
    c = StreamController<List<Rec>>(onListen: () => Future.microtask(() => c.add(_match(query))), onCancel: () => _ctrls.remove(query));
    _ctrls[query] = c;
    return c.stream;
  }

  @override
  Stream<List<String>> watchSubIds(String collection, String id, String sub) => const Stream.empty();

  @override
  Future<void> set(String collection, String id, Rec data) async => writes.add(RemoteWrite(collection, id, data));

  @override
  Future<void> delete(String collection, String id) async => writes.add(RemoteWrite(collection, id, const {}, delete: true));

  @override
  Future<void> setSub(String collection, String id, String sub, String subId, Rec data) async => joins.add((collection, id, sub, subId));
}
