import '../../school/repositories/school_seed.dart';
import '../../../utils/services/local_database_service.dart';

String _at(int dayOff, int h, [int m = 0]) {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day + dayOff, h, m).toIso8601String();
}

String _ago(int minutes) => DateTime.now().subtract(Duration(minutes: minutes)).toIso8601String();

const _feedback = [
  'Exceptional discriminant analysis',
  'Sound method, minor algebraic slip in Q3',
  'Standard rubric complete',
  'Formula recall gap, incomplete proof',
  'Neat working, check units',
  'Good attempt, revise factorisation',
];

/// Splits [total] marks across the four default rubric criteria (30/30/20/20 %).
List<int> _split(int total, int max) {
  final w = [.3, .3, .2, .2];
  final caps = [for (final x in w) (max * x).round()];
  final out = <int>[];
  var left = total;
  for (var i = 0; i < 4; i++) {
    final v = i == 3 ? left : (total * w[i]).round().clamp(0, caps[i]);
    out.add(v.clamp(0, caps[i]));
    left -= out.last;
  }
  return out;
}

Rec _hw(String id, String classId, String title, String subject, int dueOff, int max, String desc, {required int graded, required int submitted, String status = 'open'}) {
  final ids = [for (final s in schoolSeed['students']!) if (s['classId'] == classId) s['id'] as String];
  final subs = <String, dynamic>{};
  for (var i = 0; i < ids.length; i++) {
    if (i < graded) {
      final pct = 48 + (i * 37) % 50;
      final marks = (max * pct / 100).round();
      subs[ids[i]] = {
        'status': 'graded', 'marks': marks, 'criteria': _split(marks, max),
        'feedback': i % 3 == 2 ? '' : _feedback[i % _feedback.length], 'gradedAt': _ago(20 + i * 17),
      };
    } else if (i < graded + submitted) {
      subs[ids[i]] = {'status': 'submitted'};
    } else {
      subs[ids[i]] = {'status': 'pending'};
    }
  }
  return {
    'id': id, 'classId': classId, 'title': title, 'subject': subject, 'due': _at(dueOff, 16).substring(0, 10), 'maxMarks': max,
    'description': desc, 'status': status, 'createdAt': _at(-7, 9), 'submissions': subs,
  };
}

Rec _task(String id, String title, String cat, String pri, String classId, String due, {String kind = 'task', String status = 'pending', String? sub, String? label, String? tag, String? notes, String? hw, int? reviewed, int? total, bool notify = true, String? doneAt}) => {
      'id': id, 'title': title, 'kind': kind, 'category': cat, 'priority': pri, 'classId': classId, 'due': due, 'status': status,
      'subtitle': sub ?? '', 'label': label ?? '', 'tag': tag ?? '', 'notes': notes ?? '', 'homeworkId': hw ?? '',
      'reviewed': reviewed, 'total': total, 'notify': notify, 'doneAt': doneAt,
    };

List<Rec> _tasks() {
  const doneTitles = [
    'Mark Period 1 attendance', 'Upload Unit Test 2 scores', 'Prepare Algebra worksheet', 'Sign Class 10-B diary', 'Collect lab records',
    'Update seating chart', 'Share revision notes', 'Review Force & Motion quiz', 'Submit weekly lesson plan', 'Check homework notebooks',
    'Reply to parent queries', 'Print practice papers', 'Verify marks register', 'Prepare Optics demo', 'Return graded assignments',
    'Update class progress sheet', 'Collect permission slips', 'Arrange lab equipment', 'Draft CCE rubric', 'Mentor session notes',
    'Moderate answer keys', 'Sync attendance with registrar', 'Plan remedial batch',
  ];
  final done = [
    for (var i = 0; i < doneTitles.length; i++)
      _task('t_done$i', doneTitles[i], ['Academic & Grading', 'Lesson Prep', 'Admin & Compliance'][i % 3], 'normal', 'cls_10B', _at(0, 9), status: 'done', doneAt: _ago(5 + i)),
  ];
  return [
    _task('t_mid', 'Grade 10-B Math Term Mid-Papers', 'Academic & Grading', 'urgent', 'cls_10B', _at(0, 17),
        notes: 'Continuous Comprehensive Evaluation (CCE) upload for 42 enrolled students.', reviewed: 38, total: 42),
    _task('t_qe', 'Quadratic Equations Homework', 'Academic & Grading', 'medium', 'cls_10B', _at(0, 16), label: 'Pending', tag: '3 Files', hw: 'hw_set4'),
    _task('t_sub', 'Class 8-C Physics Substitution Notes', 'Academic & Grading', 'medium', 'cls_8C', _at(1, 9),
        status: 'in_progress', sub: 'Handover Prep • Period 3 Lab Session', label: 'In Progress', tag: 'Lab Manual'),
    _task('t_reg', 'Update Internal Marks Register', 'Academic & Grading', 'normal', 'cls_9A', _at(11, 15), sub: 'Class 9-A • Unit Test 2 entries'),
    _task('t_lab', 'Review 9-A Lab Reports', 'Academic & Grading', 'normal', 'cls_9A', _at(10, 14), sub: 'Class 9-A • Force & Motion practical'),
    _task('t_att', 'Submit Monthly Attendance Audit', 'Admin & Compliance', 'medium', '', _at(4, 12),
        sub: 'TCH-16 Standard Audit compliance • Registrar', label: 'Action Req.', tag: 'Auto-sync'),
    _task('t_syl', 'Upload Term 2 Syllabus Review', 'Admin & Compliance', 'normal', '', _at(9, 12),
        sub: 'Academic Council Quarterly Documentation', label: 'Draft Saved', tag: 'Auto-sync'),
    _task('t_dev', 'Dev Malhotra (Roll 14)', 'Student Follow-up', 'medium', 'cls_10B', _at(0, 18),
        sub: 'Absent 3 consecutive days • Medical leave note pending', label: 'Follow-up'),
    _task('t_rem1', 'Collect signed progress cards', 'Reminder', 'normal', 'cls_10B', _at(0, 13), kind: 'reminder', notes: 'Before lunch break'),
    _task('t_rem2', 'Parent meeting prep for Class 10-A', 'Reminder', 'normal', 'cls_10A', _at(12, 10), kind: 'reminder'),
    _task('t_les1', 'Plan remedial session for 10-B', 'Lesson Prep', 'normal', 'cls_10B', _at(9, 11), sub: 'Quadratic equations • weak-area batch'),
    _task('t_les2', 'Prepare Coordinate Geometry worksheet', 'Lesson Prep', 'normal', 'cls_10B', _at(13, 11), sub: 'Distance & section formula'),
    ...done,
  ];
}

List<Rec> _duties() => [
      {
        'id': 'd_gate', 'type': 'gate', 'title': 'Morning Gate Duty & Assembly', 'start': _at(0, 8), 'end': _at(0, 8, 30), 'venue': 'Senior Wing Main Gate',
        'role': 'Gate Supervisor', 'status': 'done', 'staff': [], 'docs': [], 'note': '',
      },
      {
        'id': 'd_meet1', 'type': 'meeting', 'title': 'Curriculum & Half-Yearly Review', 'start': _at(0, 15, 30), 'end': _at(0, 16, 30), 'venue': 'Conference Room A',
        'role': 'Attendee (Mathematics Dept)', 'status': 'upcoming', 'mandatory': true, 'chair': 'Dr. Kavita Rao', 'tag': 'Faculty Briefing',
        'agendaTitle': 'Staff Briefing Session', 'floor': 'Conf. Room A, Floor 3',
        'agenda': [
          {'t': 'Syllabus Completion Audit', 'min': 15}, {'t': 'Blueprint & Question Bank', 'min': 20},
          {'t': 'Remedial Action Plans', 'min': 15}, {'t': 'Open Q&A & Resource Sharing', 'min': 10},
        ],
        'preRead': {'name': 'Term2_Curriculum_Draft.pdf', 'size': '1.8 MB'}, 'staff': [], 'docs': [],
      },
      {
        'id': 'd_exam1', 'code': 'DUTY-8842', 'type': 'exam', 'title': 'Half-Yearly Examination (Physics & Math)', 'start': _at(1, 9), 'end': _at(1, 12),
        'venue': 'Hall B (Rooms 304–308)', 'venue2': 'Senior Wing, 3rd Floor', 'role': 'Chief Invigilator', 'role2': 'Senior Syndicate', 'status': 'upcoming',
        'subtitle': 'Term 2 Centralized Assessment • Class 10 (Secondary Wing)', 'reportNote': 'Report to Strong Room by 08:30 AM', 'pick': 'Pick packets at 8:40 AM',
        'lead': 'Mr. R. Kapoor', 'candidates': '42 Students', 'candidates2': 'Class 10-A & 10-B',
        'staff': [
          {'name': 'Mr. Rajesh Deshmukh', 'role': 'Co-Invigilator • Physics Dept', 'relief': false},
          {'name': 'Mrs. Sunita Kapoor', 'role': 'Relief Duty (10:30 – 11:00 AM)', 'relief': true},
        ],
        'docs': [{'name': 'Seating Plan', 'size': '1.2 MB', 'kind': 'pdf'}, {'name': 'Guidelines', 'size': '850 KB', 'kind': 'doc'}],
        'desk': 'Exam Control Desk (Ext #104)',
      },
      {
        'id': 'd_sports', 'type': 'sports', 'title': 'Inter-School Sports Meet', 'start': _at(2, 8, 30), 'end': _at(2, 13), 'venue': 'Track & Field Ground',
        'role': 'Track & Field Coordinator', 'status': 'upcoming', 'subtitle': 'Annual inter-school athletics meet', 'staff': [
          {'name': 'Mr. Vikram Nair', 'role': 'PE Department Lead', 'relief': false},
        ], 'docs': [{'name': 'Event Schedule', 'size': '640 KB', 'kind': 'pdf'}],
      },
      {
        'id': 'd_exam2', 'code': 'DUTY-8851', 'type': 'exam', 'title': 'Half-Yearly Examination (Science)', 'start': _at(3, 9), 'end': _at(3, 12),
        'venue': 'Hall C (Rooms 310–312)', 'venue2': 'Senior Wing, 3rd Floor', 'role': 'Co-Invigilator', 'role2': 'Science Dept', 'status': 'upcoming',
        'subtitle': 'Term 2 Centralized Assessment • Class 9 (Secondary Wing)', 'reportNote': 'Report to Strong Room by 08:30 AM',
        'candidates': '38 Students', 'candidates2': 'Class 9-A', 'staff': [{'name': 'Mrs. Anjali Mehta', 'role': 'Chief Invigilator • Science Dept', 'relief': false}],
        'docs': [{'name': 'Seating Plan', 'size': '980 KB', 'kind': 'pdf'}], 'desk': 'Exam Control Desk (Ext #104)',
      },
      {
        'id': 'd_meet2', 'type': 'meeting', 'title': 'Parent-Teacher Meeting Planning', 'start': _at(4, 14), 'end': _at(4, 15), 'venue': 'Staff Room 2',
        'role': 'Attendee (Mathematics Dept)', 'status': 'upcoming', 'mandatory': false, 'chair': 'Mr. S. Pillai', 'tag': 'Department Meeting',
        'agendaTitle': 'Department Meeting', 'floor': 'Staff Room 2, Floor 1',
        'agenda': [{'t': 'Slot allocation', 'min': 20}, {'t': 'Progress report format', 'min': 25}, {'t': 'Logistics', 'min': 15}],
        'preRead': {'name': 'PTM_Plan_Draft.pdf', 'size': '920 KB'}, 'staff': [], 'docs': [],
      },
    ];

List<Rec> _syllabus() => [
      {
        'id': 'syl_10a', 'cls': 'Grade 10–A', 'subject': 'Mathematics', 'hours': 42, 'labs': 8, 'lag': 0, 'note': '',
        'topics': [
          {'name': 'Quadratic Equations', 'done': 12, 'total': 12}, {'name': 'Arithmetic Progressions', 'done': 10, 'total': 10},
          {'name': 'Triangles & Similarity', 'done': 14, 'total': 14}, {'name': 'Coordinate Geometry', 'done': 6, 'total': 10},
          {'name': 'Applications of Trigonometry', 'done': 0, 'total': 8},
        ],
      },
      {
        'id': 'syl_9b', 'cls': 'Grade 9–B', 'subject': 'Mathematics', 'hours': 22, 'labs': 2, 'lag': 2, 'remedial': 'Remedial: 4 hrs conducted',
        'note': 'Pacing Note: 2 periods rescheduled for Annual Sports rehearsal. Compensatory lectures queued.',
        'topics': [
          {'name': 'Linear Equations', 'done': 10, 'total': 10}, {'name': "Euclid's Geometry", 'done': 10, 'total': 10},
          {'name': 'Lines and Angles', 'done': 7, 'total': 10}, {'name': 'Quadrilaterals', 'done': 0, 'total': 6},
        ],
      },
      {
        'id': 'syl_12a', 'cls': 'Grade 12–A', 'subject': 'Advanced Math', 'hours': 20, 'labs': 2, 'lag': 0, 'remedial': 'Target Remedials & Problem Sets',
        'note': 'Targeting revision workshops prior to Pre-Boards examination.',
        'topics': [{'name': 'Matrix & Calculus', 'done': 17, 'total': 20}],
      },
    ];

final Seed tasksSeed = {
  'tk_tasks': _tasks(),
  'tk_duties': _duties(),
  'tk_swaps': [],
  'tk_syllabus': _syllabus(),
  'tk_syllabus_meta': [
    {'id': 'tk_syllabus_meta', 'status': 'draft', 'target': 80, 'due': _at(7, 17)},
  ],
  'tk_homework': [
    _hw('hw_set4', 'cls_10B', 'Quadratic Equations - Set 4', 'Mathematics', 0, 50, 'Formative Assessment • Chapter 4 Benchmark', graded: 30, submitted: 4),
    _hw('hw_review', 'cls_10A', 'Quadratic Equations Review', 'Mathematics', 1, 50, 'Formative Assessment • Chapter 4 Benchmark', graded: 28, submitted: 14),
    _hw('hw_force', 'cls_9A', 'Force & Motion Worksheet', 'Science', 3, 25, 'Numerical problems on Newton\'s laws', graded: 12, submitted: 0),
    _hw('hw_optics', 'cls_8C', 'Light & Optics Lab Record', 'Physics', 5, 30, 'Complete the ray diagram experiments record', graded: 0, submitted: 0),
    _hw('hw_coord3', 'cls_10B', 'Coordinate Geometry - Set 3', 'Mathematics', -6, 40, 'Distance, section and area formulas', graded: 40, submitted: 0, status: 'closed'),
  ],
};
