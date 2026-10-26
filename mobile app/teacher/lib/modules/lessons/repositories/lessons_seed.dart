import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/local_database_service.dart';

List<Rec> _ms(List<String> t, int done, {int? today}) => [
      for (var i = 0; i < t.length; i++) {'title': t[i], 'done': i < done, 'today': i == today}
    ];

Rec _plan(String id, String code, String cls, String subject, String title, String summary,
        {required String stage, bool draft = false, int day = 1, int days = 5, int periods = 6, String ncert = '', String date = '',
        List<Rec> milestones = const [], String sched = '', String bloom = 'Apply', String outcome = '', String saved = ''}) =>
    {
      'id': id, 'code': code, 'cls': cls, 'subject': subject, 'term': 'Term 2', 'title': title, 'summary': summary, 'stage': stage, 'draft': draft,
      'day': day, 'days': days, 'periods': periods, 'ncert': ncert, 'date': date.isEmpty ? plusDays(1) : date, 'milestones': milestones, 'sched': sched, 'bloom': bloom,
      'outcome': outcome, 'saved': saved, 'concepts': <String>[],
      'objectives': <Rec>[], 'activities': <Rec>[], 'resources': <Rec>[], 'approval': '',
    };

final Seed lessonsSeed = {
  'ls_plans': [
    {
      ..._plan('lp_1', 'LP-M10-04', '10-B', 'Mathematics', 'Chapter 4: Quadratic Equations & Applications',
          'Solving projectile word problems using vertex formula and factoring methods.',
          stage: 'ongoing', day: 3, days: 5, ncert: 'NCERT Ch 4.3', sched: 'Period 2 & 4',
          milestones: _ms(['Derivation of Quadratic Formula', 'Standard Form & Discriminant Analysis', 'Vertex & Projectile Trajectories', 'Group Problem Solving Drill'], 2, today: 2),
          bloom: 'Apply', outcome: 'Students will formulate quadratic models from projectile trajectory scenarios and solve for maximum height using vertex derivation.'),
      'concepts': ['Vertex Optimization', 'Word Problems', 'Projectile Ceilings'],
      'objectives': [
        {'title': 'Derive standard parabolic vertex (-b/2a)', 'desc': 'Students establish horizontal shift symmetry directly from roots calculation.'},
        {'title': 'Map trajectory equations h(t) = -16t² + vt + s', 'desc': 'Translating velocity and initial displacement into instantaneous peak height.'},
        {'title': 'Interpret physical meaning of quadratic roots', 'desc': 'Differentiate extraneous negative time roots from actual projectile impact timings.'},
      ],
      'activities': [
        {'title': 'Hook & Warm-up', 'mins': 10, 'desc': 'Physical tennis ball toss demonstration to trace curvature.'},
        {'title': 'Concept Delivery', 'mins': 15, 'desc': 'Derivation of peak height vertex formula and discriminant recap.'},
        {'title': 'Guided Group Activity', 'mins': 15, 'desc': 'Paired calculation on projectile worksheets using tablets.'},
        {'title': 'Exit Ticket & Wrap-up', 'mins': 5, 'desc': '2 quick check questions submitted via student devices.'},
      ],
      'resources': [
        {'name': 'Quadratic_Word_Problems_WS3.pdf', 'meta': 'Classroom Handout • 1.8 MB'},
        {'name': 'Smartboard_Slides_Ch4_Day3.pptx', 'meta': 'Classroom Presentation • 4.2 MB'},
      ],
    },
    {
      ..._plan('lp_2', 'LP-P8-02', '8-C', 'Physics', 'Chapter 2: Light, Reflection & Mirrors',
          'Ray diagrams for plane and spherical mirrors with lab observation.',
          stage: 'ongoing', day: 2, days: 4, periods: 4, ncert: 'NCERT Ch 2.1', sched: 'Period 5',
          milestones: _ms(['Laws of Reflection', 'Image Formation in Mirrors', 'Lab: Ray Tracing'], 1, today: 1), bloom: 'Understand',
          outcome: 'Students will draw ray diagrams to locate images formed by mirrors.'),
      'concepts': ['Reflection', 'Ray Diagrams'],
      'objectives': [{'title': 'State the laws of reflection', 'desc': 'Verify angle of incidence equals angle of reflection.'}],
      'activities': [{'title': 'Laser Demo', 'mins': 15, 'desc': 'Observe reflection with a laser pointer and mirror.'}],
      'resources': [{'name': 'Mirror_Lab_Sheet.pdf', 'meta': 'Lab Worksheet • 0.9 MB'}],
    },
    {
      ..._plan('lp_3', 'LP-M10-05', '10-A', 'Mathematics', 'Chapter 8: Introduction to Trigonometric Identities',
          'Intuitive derivation of Pythagorean identities using unit circle coordinates.',
          stage: 'upcoming', periods: 6, date: plusDays(10), ncert: 'NCERT Ch 8.1', bloom: 'Understand', sched: 'Starts ${fmtDate(plusDays(10))}',
          outcome: 'Students derive sin²θ + cos²θ = 1 from the unit circle.', milestones: _ms(['Unit Circle Recap', 'Pythagorean Identities', 'Practice Drill'], 0)),
      'approval': 'Approved by HOD', 'resources': [{'name': 'Desmos Simulation', 'meta': 'Link • Online'}, {'name': 'Worksheet 1 & 2.pdf', 'meta': 'Classroom Handout • 1.1 MB'}],
      'concepts': ['Unit Circle', 'Identities'],
      'objectives': [{'title': 'Derive Pythagorean identities', 'desc': 'Use unit circle coordinates.'}],
      'activities': [{'title': 'Desmos Exploration', 'mins': 20, 'desc': 'Explore the unit circle interactively.'}],
    },
    {
      ..._plan('lp_4', 'LP-M9-01', '9-C', 'Foundation Math', 'Coordinate Geometry Fundamentals',
          'Section 2: Distance formula and quadrant mapping for retake students.',
          stage: 'upcoming', draft: true, periods: 3, date: plusDays(15), ncert: 'NCERT Ch 7', saved: 'Auto-saved 2h ago', bloom: 'Remember',
          outcome: 'Students locate points and compute distances on the Cartesian plane.', milestones: _ms(['Quadrants', 'Distance Formula'], 0)),
      'concepts': ['Quadrants', 'Distance Formula'], 'objectives': <Rec>[], 'activities': <Rec>[], 'resources': <Rec>[], 'approval': 'Pending Review',
    },
    {
      ..._plan('lp_5', 'LP-M10-03', '10-B', 'Mathematics', 'Chapter 3: Pair of Linear Equations',
          'Graphical and algebraic methods of solving linear pairs.',
          stage: 'completed', day: 5, days: 5, ncert: 'NCERT Ch 3', date: plusDays(-42), milestones: _ms(['Graphical Method', 'Substitution', 'Elimination'], 3)),
      'concepts': ['Graphs', 'Elimination'], 'outcome': 'Solve pairs of linear equations.',
    },
    {
      ..._plan('lp_6', 'LP-S9-03', '9-A', 'Science', 'Chapter 3: Force & Laws of Motion',
          'Newton laws with everyday examples.', stage: 'completed', day: 4, days: 4, ncert: 'NCERT Ch 9', date: plusDays(-34), milestones: _ms(['Inertia', 'F = ma', 'Action-Reaction'], 3)),
      'concepts': ['Inertia'], 'outcome': 'Apply Newton laws to problems.',
    },
  ],
  'ts_tests': [
    _test('ts_1', 'TEST-MATH10A-04', 'Trigonometric Identities & Heights Review', '10-A', 'Mathematics', 'Unit Test', 'upcoming', plusDays(1), '09:30', 60, 39, 30),
    _test('ts_2', 'TEST-MATH9C-02', 'Linear Equations in Two Variables - Diagnostic', '9-C', 'Foundation Math', 'Quiz', 'upcoming', plusDays(2), '11:00', 30, 36, 20),
    _test('ts_3', 'TEST-MATH10B-04', 'Quadratic Equations Chapter Quiz', '10-B', 'Mathematics', 'Quiz', 'live', todayIso(), '10:00', 30, 42, 10),
    _test('ts_4', 'TEST-MATH10B-03', 'Unit Test 3: Quadratic Equations & Roots', '10-B', 'Mathematics', 'Unit Test', 'completed', plusDays(-7), '09:30', 45, 42, 12,
        results: {'submitted': 40, 'avg': 71, 'high': 49, 'low': 18}),
  ],
  'cr_templates': [
    for (final t in const [
      ['tp_1', 'Gold Prestige', 'Academic Merit', 'Honorary gold foil and seal', 'Landscape', 0xFFB45309],
      ['tp_2', 'Modern Minimalist', 'Academic Merit', 'Clean layout with high scanning clarity', 'Landscape', 0xFF2F4FD8],
      ['tp_3', 'Excellence Ribbon', 'Academic Merit', 'Classic navy with gold medal icon', 'Portrait', 0xFF1E3A8A],
      ['tp_4', 'STEM Division Crest', 'Academic Merit', 'Deep teal modern styling', 'Landscape', 0xFF0F766E],
      ['tp_5', 'Athletic Star Champion', 'Sports & Athletics', 'Vibrant accents with laurel crown', 'Landscape', 0xFFDC2626],
      ['tp_6', 'Track & Field Medal', 'Sports & Athletics', 'Bold stripes and medal artwork', 'Portrait', 0xFFEA580C],
      ['tp_7', 'Team Spirit', 'Sports & Athletics', 'Team crest with ribbon banner', 'Landscape', 0xFFB91C1C],
      ['tp_8', 'Art & Creative Expression', 'Arts & Creative', 'Pastel flourish framing', 'Landscape', 0xFFDB2777],
      ['tp_9', 'Music Maestro', 'Arts & Creative', 'Elegant typography with note motif', 'Portrait', 0xFF7C3AED],
      ['tp_10', 'Drama Guild', 'Arts & Creative', 'Stage curtain border', 'Landscape', 0xFF9333EA],
      ['tp_11', 'Valedictorian & Leadership', 'Leadership & Prefect', 'Double border with heraldic insignia', 'Landscape', 0xFF334155],
      ['tp_12', 'Prefect Investiture', 'Leadership & Prefect', 'Formal governance council seal', 'Portrait', 0xFF0F172A],
    ])
      {'id': t[0], 'name': t[1], 'category': t[2], 'desc': t[3], 'orientation': t[4], 'color': t[5], 'popular': t[0] == 'tp_1'}
  ],
  'cr_certs': [
    _cert('cc_1', 'stu_103', 'Dev Malhotra', 3, '10-B', 'Perfect Attendance (September)', 'has achieved an exemplary 100% attendance rate with perfect punctuality for the academic month of September 2024.', 'issued', plusDays(-9), 'tp_2'),
    _cert('cc_2', 'stu_104', 'Simran Kaur', 4, '10-B', 'Science Exhibition Best Project', 'for the best project at the Annual Science Exhibition 2024.', 'issued', plusDays(-14), 'tp_4'),
    _cert('cc_3', 'stu_105', 'Aditya Rao', 5, '10-B', 'Mathematics Olympiad Participation', 'for active participation in the School Mathematics Olympiad.', 'issued', plusDays(-22), 'tp_1'),
    _cert('cc_4', 'stu_106', 'Isha Nair', 6, '10-B', 'Academic Merit - Term 1', 'in recognition of outstanding academic performance in Term 1.', 'pending', plusDays(-4), 'tp_1'),
    _cert('cc_5', 'stu_107', 'Arjun Singh', 7, '10-B', 'Sports Star - Inter-House Meet', 'for winning gold in the Inter-House athletics meet.', 'pending', plusDays(-3), 'tp_5'),
    _cert('cc_6', 'stu_108', 'Meera Gupta', 8, '10-B', 'Best Class Representative', 'for leadership and service as class representative.', 'pending', plusDays(-2), 'tp_11'),
    _cert('cc_7', 'stu_109', 'Kabir Reddy', 9, '10-B', '100% Attendance (August)', 'for perfect attendance in August 2024.', 'pending', plusDays(-1), 'tp_2'),
  ],
  'cr_mine': [
    _mine('cm_1', 'CBSE Advanced Pedagogical Certification', 'Central Board of Secondary Education (CBSE)', 'verified', 'cert', ['Inquiry-Based Learning', 'Competency Assessments', 'NEP 2020 Aligned'], 'Jan 2023 – Jan 2028', 'CBSE-PED-9941', 0),
    _mine('cm_2', 'National ICT & Digital Classroom Excellence', 'Ministry of Education & NCERT', 'verified', 'cpd', ['Smart Classroom Tech', 'Hybrid Pedagogy'], 'Lifetime Validity • Sep 2023', 'MOE-ICT-8842', 24),
    _mine('cm_3', 'Olympiad Math Master Coach (Level 2)', 'Science Olympiad Foundation (SOF)', 'expiring', 'cert', ['Number Theory', 'Combinatorics', 'Adv. Problem Solving'], 'Aug 2022 – Aug 2025', 'SOF-COACH-771', 18),
    _mine('cm_4', 'Differential Calculus & Senior Pedagogy', 'Indian Institute of Science (IISc)', 'verified', 'degree', ['Applied Calculus', 'Curriculum Design'], 'Lifetime Validity • Issued May 2021', 'IIS-CALC-102', 0),
    _mine('cm_5', 'M.Sc. Mathematics', 'University of Delhi', 'verified', 'degree', ['Algebra', 'Analysis'], 'Lifetime Validity • 2012', 'DU-MSC-4410', 0),
    _mine('cm_6', 'B.Ed. Secondary Education', 'IGNOU', 'verified', 'cert', ['Pedagogy'], 'Lifetime Validity • 2014', 'IGNOU-BED-221', 0),
  ],
};

Rec _mine(String id, String title, String issuer, String status, String kind, List<String> tags, String validity, String code, int hrs) =>
    {'id': id, 'title': title, 'issuer': issuer, 'status': status, 'kind': kind, 'tags': tags, 'validity': validity, 'code': code, 'hours': hrs};

Rec _cert(String id, String sid, String name, int roll, String cls, String title, String citation, String status, String date, String tpl) => {
      'id': id, 'studentId': sid, 'student': name, 'roll': roll, 'cls': cls, 'title': title, 'citation': citation, 'status': status, 'date': date,
      'templateId': tpl, 'authority': 'Academic Council', 'code': 'DPS-2024-CERT-${8800 + roll * 7}',
    };

Rec _test(String id, String code, String title, String cls, String subject, String type, String status, String date, String time, int mins, int students, int nq,
        {Map<String, dynamic>? results}) =>
    {
      'id': id, 'code': code, 'title': title, 'cls': cls, 'subject': subject, 'type': type, 'status': status, 'date': date, 'time': time, 'duration': mins,
      'students': students, 'cutoff': 36, 'proctor': true, 'grace': true, 'notify': true, 'nq': nq, 'results': results,
      'questions': [
        {'id': '${id}_q1', 'section': 'A', 'type': 'MCQ', 'prompt': 'Find the value of sin 30° + cos 60°:', 'marks': 1, 'options': ['1', '1/2', '√3/2', '0'], 'correct': 0},
        {'id': '${id}_q2', 'section': 'A', 'type': 'MCQ', 'prompt': 'If the discriminant b² - 4ac > 0, the roots are:', 'marks': 1, 'options': ['Real and distinct', 'Real and equal', 'Imaginary', 'None'], 'correct': 0},
        {'id': '${id}_q3', 'section': 'B', 'type': 'Short Answer', 'prompt': 'Prove that (tan θ + sec θ - 1)/(tan θ - sec θ + 1) = (1 + sin θ)/cos θ.', 'marks': 3, 'options': <String>[], 'correct': 0},
      ],
    };
