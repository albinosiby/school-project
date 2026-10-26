import '../../../config/routes/routes.dart';
import '../../../di/demo_fixture.g.dart';
import '../../school/repositories/school_seed.dart' show teacherStaffId;
import '../../../utils/services/local_database_service.dart';

const _short = {'Mathematics': 'Math', 'Science': 'Sci', 'Physics': 'Phy'};
const _dayNo = {'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6};

// Teacher-only extras, Mon..Sat x P1..P6, used for the slots the fixture gives her no class:
// S = substitution duty, R = remedial lab, P = free / prep. The substitution slots match fixtureSubstitutions.
const _extras = [
  ['', '', '', '', 'S', 'P'],
  ['', '', 'P', '', '', 'R'],
  ['R', '', '', '', '', ''],
  ['', '', '', '', 'R', ''],
  ['', 'P', '', '', '', 'S'],
  ['', '', 'R', '', 'S', 'P'],
];

String _label(String classId) => classId.substring(4).replaceFirstMapped(RegExp(r'^(\d+)'), (m) => '${m[1]}-');

/// Timetable: her slots from the fixture (ops_periods of stf_025) plus the teacher-only extras.
List<Rec> _periods() {
  final core = <String, Map<String, dynamic>>{
    for (final p in fixturePeriods)
      if (p['teacherId'] == teacherStaffId) '${_dayNo[p['day']]}_P${p['period']}': p,
  };
  final rows = <Rec>[];
  for (var d = 1; d <= 6; d++) {
    for (var i = 1; i <= 6; i++) {
      final slot = 'P$i';
      final base = {'id': 'tp_${d}_$slot', 'day': d, 'slot': slot};
      final p = core['${d}_$slot'];
      if (p != null) {
        final cls = fixtureAssignments.firstWhere((a) => a['classId'] == p['classId'] && a['teacherId'] == teacherStaffId);
        rows.add({...base, 'kind': 'core', 'classId': p['classId'], 'label': _label('${p['classId']}'), 'subject': p['subject'], 'short': _short[p['subject']] ?? p['subject'], 'room': p['room'], 'topic': cls['topic'] ?? ''});
        continue;
      }
      switch (_extras[d - 1][i - 1]) {
        case 'S':
          final sub = fixtureSubstitutions.firstWhere((x) => x['substituteTeacherId'] == teacherStaffId && _dayNo[x['day']] == d && x['period'] == i);
          final cls = fixtureClasses.firstWhere((c) => c['id'] == sub['classId']);
          rows.add({...base, 'kind': 'sub', 'classId': sub['classId'], 'label': _label('${sub['classId']}'), 'subject': '${sub['subject']} (Sub)', 'short': 'Sub', 'room': cls['room'], 'topic': sub['topic'] ?? '', 'subId': sub['id']});
        case 'R':
          rows.add({...base, 'kind': 'remedial', 'classId': 'cls_10B', 'label': '10-B', 'subject': 'Remedial Lab', 'short': 'Lab', 'room': 'Math Lab', 'topic': 'Doubt clearing'});
        default:
          rows.add({...base, 'kind': 'prep', 'label': 'Prep', 'subject': 'Free / Prep', 'short': 'Prep', 'room': 'Staff Room 2', 'topic': ''});
      }
    }
  }
  return rows;
}

// Lesson brief (checklist, files, contacts) kept on the teacher's side for each substitution duty.
const _briefs = <String, Map<String, dynamic>>{
  'sub_1': {
    'dept': 'Physics Dept.', 'role': 'PGT Senior', 'posted': '12:30 PM Today', 'tag': 'Practical Verification', 'chapter': 'Ch. 5 Friction & Force Dynamics',
    'objective': 'Coefficient of Friction Verification & Group Experiments',
    'directive': 'Distribute friction worksheets on teacher demo bench. Guide students through spring balance calibration in groups of 4. Mandatory safety goggles in Lab 2.',
    'room': 'Science Lab 2 (G. Floor)',
    'tasks': [
      {'t': 'Take class roll call', 's': '40 students in Section 8–C', 'done': true},
      {'t': 'Distribute friction worksheets', 's': 'Ready on teacher bench', 'done': false},
      {'t': 'Supervise spring balance demonstration', 's': '8 workstation groups', 'done': false},
      {'t': 'Collect completed problem sets', 's': "Store in folder '8-C Physics'", 'done': false},
    ],
    'files': [
      {'name': 'Friction Worksheet.pdf', 'meta': '1.8 MB • 3 Pages'},
      {'name': 'Lab Setup & Roster.pdf', 'meta': '640 KB • Stations'},
    ],
    'contacts': [
      {'name': 'Neel Nair', 'role': 'Prefect • Key access'},
      {'name': 'Mr. Ramesh', 'role': 'Lab Asst • Ext 204'},
    ],
  },
  'sub_2': {
    'dept': 'Physics Dept.', 'role': 'PGT Senior', 'posted': 'Yesterday', 'tag': 'Revision', 'chapter': 'Ch. 6 Light & Reflection',
    'objective': 'Revision of reflection laws with ray diagrams', 'directive': 'Revise laws of reflection using the ray diagram sheets and collect the practice questions.', 'room': 'Room 118',
    'tasks': [
      {'t': 'Take class roll call', 's': '40 students in Section 8–C', 'done': false},
      {'t': 'Revise laws of reflection', 's': 'Ray diagram sheets', 'done': false},
    ],
    'files': [
      {'name': 'Reflection Practice.pdf', 'meta': '920 KB • 2 Pages'}
    ],
    'contacts': [
      {'name': 'Kabir N.', 'role': 'Class rep'}
    ],
  },
  'sub_3': {
    'dept': 'Physics Dept.', 'role': 'PGT Senior', 'posted': 'Today', 'tag': 'Self study', 'chapter': 'Ch. 7 Electricity', 'objective': 'Supervised self-study with chapter questions',
    'directive': 'Keep the class engaged with the chapter-end questions. No new topics.', 'room': 'Room 118',
    'tasks': [
      {'t': 'Take class roll call', 's': '40 students in Section 8–C', 'done': false},
    ],
    'files': <Rec>[],
    'contacts': <Rec>[],
  },
};

const _subStatus = {'Assigned': 'pending', 'Accepted': 'accepted', 'Declined': 'declined'};

/// Substitution duties = fixtureSubstitutions assigned to her, with the absent teacher's name and department from the fixture staff.
List<Rec> _subs() => [
      for (final s in fixtureSubstitutions)
        if (s['substituteTeacherId'] == teacherStaffId)
          () {
            final absent = fixtureStaff.firstWhere((t) => t['id'] == s['absentTeacherId']);
            final b = _briefs[s['id']] ?? const <String, dynamic>{};
            final cid = '${s['classId']}';
            return <String, dynamic>{
              'id': s['id'], 'day': _dayNo[s['day']], 'slot': 'P${s['period']}', 'status': _subStatus[s['status']] ?? 'pending', 'classLabel': '${_label(cid)} ${s['subject']}',
              'subject': s['subject'], 'classId': cid, 'faculty': absent['name'], 'dept': b['dept'] ?? '${absent['department']} Dept.', 'role': b['role'] ?? absent['role'],
              'room': b['room'] ?? fixtureClasses.firstWhere((c) => c['id'] == cid)['room'], 'posted': b['posted'] ?? s['date'], 'tag': b['tag'] ?? 'Substitution',
              'chapter': b['chapter'] ?? s['topic'] ?? '', 'objective': b['objective'] ?? s['topic'] ?? '', 'directive': b['directive'] ?? s['note'] ?? '',
              'tasks': b['tasks'] ?? const <Rec>[], 'files': b['files'] ?? const <Rec>[], 'contacts': b['contacts'] ?? const <Rec>[],
            };
          }(),
    ];

List<Rec> _notifications() {
  final now = DateTime.now();
  String ago(Duration d) => now.subtract(d).toIso8601String();
  DateTime day(int back, int h, int m) {
    final b = DateTime(now.year, now.month, now.day).subtract(Duration(days: back));
    return DateTime(b.year, b.month, b.day, h, m);
  }

  return [
    {'id': 'n_1', 'type': 'leave', 'category': 'Duties', 'tag': 'Leave Request', 'title': 'Ananya Reddy (#02 • 10-B)', 'body': 'Requested 2 days medical leave (28–29 Oct)', 'at': ago(const Duration(minutes: 10)), 'read': false, 'route': RoutePaths.leaveManagement},
    {'id': 'n_2', 'type': 'homework', 'category': 'Academic', 'tag': 'Homework', 'title': 'Quadratic Equations Homework Set', 'body': '38/42 submitted • 90%', 'at': ago(const Duration(minutes: 45)), 'read': false, 'route': RoutePaths.tasks},
    {'id': 'n_3', 'type': 'exam', 'category': 'Duties', 'tag': 'Exam Duty', 'title': 'Exam Invigilation Duty Assigned', 'body': 'Hall 3 • Mathematics Term 2 Mid-Papers at 9:00 AM', 'at': ago(const Duration(hours: 2)), 'read': false, 'route': RoutePaths.examDuties},
    {'id': 'n_4', 'type': 'chat', 'category': 'Messages', 'tag': 'Parent Chat', 'title': "Mrs. Priya Sharma (Aarav's Mother)", 'body': "Thank you Ma'am, Aarav will attend the extra class on Friday.", 'at': day(1, 16, 15).toIso8601String(), 'read': true, 'route': RoutePaths.messages},
    {'id': 'n_5', 'type': 'circular', 'category': 'Academic', 'tag': 'Circular', 'title': 'Circular CIR-2026-089 Published', 'body': 'Blueprint & timetable for Term 2 Pre-Board examinations', 'at': day(1, 11, 30).toIso8601String(), 'read': true, 'route': RoutePaths.circulars},
    {'id': 'n_6', 'type': 'attendance', 'category': 'Duties', 'tag': 'Attendance', 'title': 'Regularization Approved', 'body': 'Morning punch-in request for the previous Friday was approved by the admin desk.', 'at': day(2, 9, 5).toIso8601String(), 'read': true, 'route': RoutePaths.attendanceHistory},
    {'id': 'n_7', 'type': 'chat', 'category': 'Messages', 'tag': 'Parent Chat', 'title': 'Mr. Arvind Kapoor (Diya\'s Father)', 'body': 'Could we schedule a short meeting about the unit test result?', 'at': day(2, 18, 40).toIso8601String(), 'read': true, 'route': RoutePaths.messages},
    {'id': 'n_8', 'type': 'homework', 'category': 'Academic', 'tag': 'Homework', 'title': 'Optics Worksheet Reviewed', 'body': '34/38 submissions checked for Grade 9-A Science', 'at': day(3, 14, 20).toIso8601String(), 'read': true, 'route': RoutePaths.tasks},
  ];
}

final Seed homeSeed = {
  'settings': [
    {
      'id': 'settings', 'biometric': true, 'classUpdates': true, 'parentMessages': true, 'urgent': true, 'sound': true,
      'defaultClass': 'cls_10B', 'quickMark': true, 'dnd': false, 'dndFrom': '18:00', 'dndTo': '07:30', 'parentMute': false, 'sync': 'Real-time',
      'lastSync': DateTime.now().subtract(const Duration(minutes: 2)).toIso8601String(),
    }
  ],
  'hm_profile': [
    {
      'id': 'hm_profile', 'department': 'Science & Maths', 'bloodGroup': 'O+ (Positive)', 'emergency': '+91 98110 33819', 'validThrough': '31 Mar 2027',
      'token': 'DPS-FAC-2018-042-MTH', 'cardNo': '#9482-B', 'desk': 'Staff Room 2, Desk #14 (North Wing)', 'attendancePct': 98.2, 'experience': 8,
      'qualifications': [
        {'title': 'M.Sc. Mathematics', 'note': 'Gold Medalist', 'tone': 'warning'},
        {'title': 'B.Ed. Pedagogy', 'note': 'Honors', 'tone': 'neutral'},
        {'title': 'CBSE Master Trainer', 'note': '#TR-8842', 'tone': 'neutral'},
      ],
    }
  ],
  'tt_periods': _periods(),
  'tt_subs': _subs(),
  'notifications': _notifications(),
  'hm_pending': [
    {'id': 'hp_1', 'tag': 'URGENT', 'tone': 'danger', 'due': 'Due Today, 5:00 PM', 'title': 'Submit Term 2 Grade 10-A Math Unit Test Marks', 'desc': '34 of 42 student test records pending input', 'route': RoutePaths.marksEnter, 'done': false},
    {'id': 'hp_2', 'tag': 'CLASS TEACHER', 'tone': 'brand', 'due': 'Due Tomorrow', 'title': 'Review Leave Application: Rahul Verma (10-B)', 'desc': 'Medical leave for 3 days • Parent note attached', 'route': RoutePaths.leaveManagement, 'done': false},
    {'id': 'hp_3', 'tag': 'HOMEWORK', 'tone': 'warning', 'due': 'Due Oct 24', 'title': 'Upload Weekly Homework Assignment (Grade 9-A Science)', 'desc': 'Chapter 4: Optics & Refraction worksheet', 'route': RoutePaths.homeworkNew, 'done': false},
    {'id': 'hp_4', 'tag': 'ATTENDANCE', 'tone': 'success', 'due': 'Due Friday', 'title': 'Verify monthly attendance register (Grade 10-B)', 'desc': 'Sign off before sending to the admin desk', 'route': RoutePaths.attendanceHistory, 'done': false},
  ],
  'hm_reminders': [
    {'id': 'hr_1', 'title': 'Staff Meeting: Curriculum Review', 'time': '3:30 PM', 'place': 'Conference Room A • In-person & Hybrid live', 'route': RoutePaths.meetings},
    {'id': 'hr_2', 'title': 'Exam Duty: Half-Yearly Hall', 'time': 'Tomorrow 9:00 AM', 'place': 'Examination Hall B • Senior Wing', 'route': RoutePaths.examDuties},
  ],
};
