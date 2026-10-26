import '../../school/repositories/school_seed.dart';
import '../../../utils/services/local_database_service.dart';
import '../../../utils/helpers/date_helper.dart';

String _t(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
String _ago(int mins) => DateTime.now().subtract(Duration(minutes: mins)).toIso8601String();

// ---------------------------------------------------------------- live classes
List<Rec> _live() {
  final soon = _t(DateTime.now().add(const Duration(minutes: 25)));
  final rows = <Rec>[
    {
      'id': 'lv_1', 'title': 'Class 10–B: Quadratic Equations Doubt Clearing', 'classId': 'cls_10B', 'audience': 'Class 10–B (42 Students)', 'subject': 'Mathematics',
      'category': 'Doubt Clearing', 'date': plusDays(0), 'time': soon, 'mins': 45, 'room': 'Room #04', 'medium': 'In-App Live',
      'link': 'https://meet.google.com/edu-cls-10b', 'record': true, 'mute': true, 'studentShare': true, 'notify': true, 'material': null,
      'joined': 34, 'total': 42, 'tag': 'STARTS IN 25 MINS', 'status': 'upcoming', 'cohost': '',
    },
    {
      'id': 'lv_2', 'title': 'Olympiad Math: Symmetric Roots Masterclass', 'classId': 'cls_10A', 'audience': 'Class 10-A/B Advanced Batch (12 Students enrolled)', 'subject': 'Mathematics',
      'category': 'Masterclass', 'date': plusDays(1), 'time': '17:00', 'mins': 60, 'room': 'Room #02', 'medium': 'Zoom', 'link': 'https://zoom.us/j/edu-olympiad',
      'record': true, 'mute': true, 'studentShare': false, 'notify': true, 'material': {'name': 'Problem Sheet Set-B.pdf', 'size': '1.8 MB'},
      'joined': 0, 'total': 12, 'tag': '', 'status': 'upcoming', 'cohost': '',
    },
    {
      'id': 'lv_3', 'title': 'Trigonometric Ratios Concept Revision', 'classId': 'cls_10B', 'audience': 'Class 10 Remedial Group', 'subject': 'Science Remedial',
      'category': 'Revision & Quiz', 'date': plusDays(2), 'time': '15:45', 'mins': 45, 'room': 'Room #07', 'medium': 'Google Meet', 'link': 'https://meet.google.com/trg-rati-010',
      'record': false, 'mute': true, 'studentShare': false, 'notify': true, 'material': null, 'joined': 0, 'total': 18, 'tag': '', 'status': 'upcoming', 'cohost': 'Ms. Anjali Mehta',
    },
  ];
  const past = ['Linear Equations Revision', 'Light & Optics: Reflection', 'Force & Motion Doubt Session', 'Coordinate Geometry Practice', 'Polynomials Masterclass', 'Refraction Lab Walkthrough'];
  for (var i = 0; i < 12; i++) {
    final c = schoolSeed['classes']![i % 4];
    rows.add({
      'id': 'lv_p${i + 1}', 'title': past[i % past.length], 'classId': c['id'], 'audience': 'Class ${c['grade']}–${c['section']} (${c['students']} Students)', 'subject': c['subject'],
      'category': 'Revision & Quiz', 'date': plusDays(-(i * 3 + 1)), 'time': i.isEven ? '16:00' : '10:30', 'mins': 45, 'room': 'Room #0${i % 5 + 1}', 'medium': 'In-App Live', 'link': '',
      'record': true, 'mute': true, 'studentShare': false, 'notify': true, 'material': null, 'joined': 30 + i % 9, 'total': c['students'], 'tag': '', 'status': 'past', 'cohost': '',
    });
  }
  return rows;
}

// ---------------------------------------------------------------- leaves
List<Rec> _myLeaves() => [
      {'id': 'lm_m1', 'type': 'Casual Leave', 'from': plusDays(4), 'to': plusDays(4), 'days': 1, 'timeText': '', 'note': '1 Full Day', 'status': 'Approved', 'reason': 'Personal work', 'attachment': null, 'sanctionedBy': 'Principal Dr. A. Sharma', 'handover': 'Mr. Rajesh Deshmukh', 'handoverNote': 'Maths Substitution for Period 2 & 4 (Class 10-B)'},
      {'id': 'lm_m2', 'type': 'Medical Leave', 'from': plusDays(-10), 'to': plusDays(-9), 'days': 2, 'timeText': '', 'note': '', 'status': 'Approved', 'reason': 'Seasonal Flu & Medical Recovery', 'attachment': {'name': 'Medical_Slip_Oct14.pdf', 'size': '860 KB'}, 'sanctionedBy': '', 'handover': '', 'handoverNote': ''},
      {'id': 'lm_m3', 'type': 'Casual Leave', 'from': plusDays(-32), 'to': plusDays(-32), 'days': 0.5, 'timeText': '01:30 PM to 04:30 PM', 'note': 'Half Day (PM)', 'status': 'Approved', 'reason': 'Personal Family Commitment', 'attachment': null, 'sanctionedBy': 'Principal Dr. A. Sharma', 'handover': '', 'handoverNote': ''},
      {'id': 'lm_m4', 'type': 'Special Duty Leave', 'from': plusDays(-49), 'to': plusDays(-49), 'days': 1, 'timeText': '', 'note': "Teachers' Day State Forum", 'status': 'Completed', 'reason': 'District Academic Representation', 'attachment': null, 'sanctionedBy': '', 'handover': '', 'handoverNote': ''},
      {'id': 'lm_m5', 'type': 'Academic Workshop', 'from': plusDays(-73), 'to': plusDays(-71), 'days': 3, 'timeText': '', 'note': 'CBSE Pedagogy Summit', 'status': 'Completed', 'reason': 'National Curriculum Framework Faculty Training', 'attachment': null, 'sanctionedBy': 'Academic Director Dr. K. Raman', 'handover': '', 'handoverNote': ''},
    ];

List<Rec> _studentLeaves() {
  Rec r(String id, String name, int roll, String type, String cat, int days, String label, String dateText, String reason, Rec? att, String by, String ago, double attend, String status,
          {String classId = 'cls_10B', String? by2, int mins = 0, String? note}) =>
      {'id': id, 'name': name, 'roll': roll, 'classId': classId, 'type': type, 'cat': cat, 'days': days, 'daysLabel': label, 'dateText': dateText, 'reason': reason, 'att': att, 'by': by, 'ago': ago, 'attend': attend, 'status': status, 'processedBy': by2 ?? '', 'processedAt': mins, 'note': note ?? ''};
  final rows = <Rec>[
    r('ls_1', 'Dev Malhotra', 12, 'Medical Leave', 'medical', 2, '2 Days', '24 Oct – 25 Oct 2024', 'High viral fever since yesterday night. Doctor advised complete rest for 48 hrs.', {'name': 'Prescription_DrBatra.pdf', 'size': '1.4 MB', 'src': 'Dr. Batra Clinic'}, 'Rajesh Malhotra (Father)', '2 hrs ago', 91.2, 'pending'),
    r('ls_2', 'Simran Kaur', 8, 'Dental Surgery', 'medical', 1, '1 Day • Today', 'Today, 24 Oct 2024', 'Wisdom tooth extraction scheduled at 11:30 AM at Apollo Dental. Mild rest requested.', {'name': 'Slip.pdf', 'size': '0.6 MB', 'src': 'Medical Slip Verified by School Clinic'}, 'Gurpreet Kaur (Mother)', 'Yesterday', 95.8, 'pending'),
    r('ls_3', 'Rohan Verma', 19, 'Family Event', 'leave', 1, '1 Day • Tomorrow', 'Tomorrow, 25 Oct 2024', "Attending elder sister's wedding reception ceremony in Jaipur. Travelling overnight.", null, 'Anita Verma (Mother)', '5 hrs ago', 88.5, 'pending'),
    r('ls_4', 'Ananya Patel', 1, 'Medical Leave', 'medical', 1, '1 Day', '21 Oct 2024', 'Fever and cold.', {'name': 'Slip_Oct21.pdf', 'size': '0.4 MB', 'src': 'Family doctor'}, 'Meera Patel (Mother)', '3 days ago', 96.0, 'approved', by2: 'Mrs. Kapoor', mins: 5),
    r('ls_5', 'Aarav Sharma', 29, 'Olympiad Duty', 'duty', 2, '2 Days', '18 Oct – 19 Oct 2024', 'Representing the school at the state Olympiad.', null, 'School Office', '5 days ago', 97.1, 'approved', by2: 'Official Duty', mins: 10, note: 'Sanctioned'),
    r('ls_6', 'Kabir Nair', 22, 'Family Function', 'leave', 3, '3 Days', '07 Oct – 09 Oct 2024', 'Out of station for a family function.', null, 'Sunil Nair (Father)', '2 weeks ago', 79.0, 'rejected', by2: 'Mrs. Sharma', mins: 20),
    r('ls_7', 'Isha Gupta', 6, 'Sick Leave', 'leave', 1, '1 Day', '23 Oct 2024', 'Stomach infection.', null, 'Rekha Gupta (Mother)', '1 day ago', 93.0, 'pending', classId: 'cls_9A'),
  ];
  const names = ['Tara Singh', 'Neel Reddy', 'Meera Joshi', 'Yash Khan', 'Kavya Das', 'Zoya Menon', 'Om Verma', 'Riya Iyer', 'Veer Rao', 'Pari Mehta', 'Dev Kapoor', 'Sara Nair', 'Karan Gupta', 'Navya Patel', 'Isha Singh', 'Arjun Das'];
  for (var i = 0; i < 16; i++) {
    final med = i % 3 == 0;
    rows.add(r('ls_a${i + 1}', names[i], i + 2, med ? 'Medical Leave' : 'Family Event', med ? 'medical' : 'leave', 1, '1 Day', '${(i % 20) + 1} Oct 2024', 'Approved earlier this term.', med ? {'name': 'Slip_${i + 1}.pdf', 'size': '0.5 MB', 'src': 'Clinic'} : null, 'Parent', '${i + 2} days ago', 85 + i % 10.0, 'approved', by2: 'Mrs. Kapoor', mins: 30 + i));
  }
  return rows;
}

// ---------------------------------------------------------------- meetings
const _roomNames = [
  ['Rajesh Sharma', 'Parent of Aarav (#01)'], ['Sunita Kapoor', 'Parent of Rohan (#14)'], ['Priya Sharma', 'Parent of Meera (#05)'], ['Dr. K. V. Rao', 'Vice Principal'],
  ['Vikram Malhotra', 'Parent of Dev (#08)'], ['Ramesh Patel', 'Parent of Ananya (#02)'], ['Neha Kaur', 'Parent of Simran (#06)'], ['Anil Verma', 'Parent of Rohan V. (#19)'],
];

/// Participants + waiting-room + chat rows for a meeting (also used when a meeting is first opened).
Map<String, List<Rec>> meetingRoomRows(String mid) {
  final people = <Rec>[
    for (var i = 0; i < _roomNames.length; i++)
      {'id': 'pp_${mid}_$i', 'meetingId': mid, 'name': _roomNames[i][0], 'sub': _roomNames[i][1], 'role': i == 3 ? 'Co-Host' : 'Parent', 'muted': i != 0, 'speaking': i == 0, 'hand': i == 1 || i == 2},
  ];
  final waiting = <Rec>[
    {'id': 'pw_${mid}_1', 'meetingId': mid, 'name': 'Pooja Verma', 'sub': 'Parent of Tanya (Roll #19)', 'cls': 'Gr 10-B', 'since': _ago(2)},
    {'id': 'pw_${mid}_2', 'meetingId': mid, 'name': 'Sanjay Gupta', 'sub': 'Parent of Dhruv (Roll #07)', 'cls': 'Gr 10-B', 'since': _ago(1)},
  ];
  final chat = <Rec>[
    {'id': 'pc_${mid}_1', 'meetingId': mid, 'name': 'Mrs. Anita Sharma', 'mine': true, 'pinned': true, 'ts': _ago(35), 'text': 'Welcome parents! Please post questions here or raise your digital hand during the meeting.'},
    {'id': 'pc_${mid}_2', 'meetingId': mid, 'name': 'Rajesh Sharma', 'mine': false, 'pinned': false, 'ts': _ago(31), 'text': "Ma'am you are on mute! Please unmute."},
    {'id': 'pc_${mid}_3', 'meetingId': mid, 'name': 'Mrs. Anita Sharma', 'mine': true, 'pinned': false, 'ts': _ago(29), 'text': 'Sorry about that! Can everyone hear me clearly now?'},
    {'id': 'pc_${mid}_4', 'meetingId': mid, 'name': 'Sunita Kapoor', 'mine': false, 'pinned': false, 'ts': _ago(27), 'text': "Yes ma'am, you are loud and clear now!"},
    {'id': 'pc_${mid}_5', 'meetingId': mid, 'name': 'Dr. K. V. Rao', 'mine': false, 'pinned': false, 'ts': _ago(26), 'text': 'Slides are visible on screen now. Audio is perfectly clear.'},
  ];
  return {'pm_participants': people, 'pm_waiting': waiting, 'pm_chat': chat};
}

List<Rec> _meetings() => [
      {
        'id': 'pm_1', 'title': 'Term 2 Pre-Board Roadmap & Academic Review Townhall', 'classId': 'cls_10B', 'audience': 'Class 10-B • All Parents', 'category': 'Academic Townhall', 'format': 'Hybrid Meeting',
        'date': plusDays(3), 'time': '10:00', 'mins': 90, 'venue': 'Main Auditorium (Hall B) + Google Meet Live', 'link': 'https://meet.google.com/edu-ptm-10b',
        'agenda': [
          {'title': 'Term 1 board exam score breakdown & analytics', 'mins': 30},
          {'title': 'Remedial & booster class schedules for Term 2', 'mins': 35},
          {'title': '25-minute open parent Q&A & feedback forum', 'mins': 25},
        ],
        'rsvp': 37, 'total': 42, 'target': 95, 'file': {'name': 'Pre-Board_Roadmap_Deck.pdf', 'size': '2.4 MB'}, 'status': 'upcoming', 'invite': true, 'whatsapp': true, 'summary': '',
      },
      {
        'id': 'pm_2', 'title': 'Class 9-A Science Exhibition Orientation', 'classId': 'cls_9A', 'audience': 'Class 9-A • All Parents', 'category': 'Orientation', 'format': 'Online Meeting',
        'date': plusDays(8), 'time': '11:00', 'mins': 60, 'venue': 'Google Meet Live', 'link': 'https://meet.google.com/edu-ptm-9a',
        'agenda': [
          {'title': 'Exhibition theme and project groups', 'mins': 25},
          {'title': 'Parent volunteer sign-ups', 'mins': 35},
        ],
        'rsvp': 21, 'total': 38, 'target': 80, 'file': null, 'status': 'upcoming', 'invite': true, 'whatsapp': false, 'summary': '',
      },
      {
        'id': 'pm_3', 'title': 'Term 1 Result Discussion', 'classId': 'cls_10B', 'audience': 'Class 10-B • All Parents', 'category': 'PTM General', 'format': 'In-Person Meeting',
        'date': plusDays(-14), 'time': '10:00', 'mins': 60, 'venue': 'Room 204', 'link': '',
        'agenda': [
          {'title': 'Term 1 result analysis', 'mins': 40},
          {'title': 'Open Q&A', 'mins': 20},
        ],
        'rsvp': 39, 'total': 42, 'target': 90, 'file': null, 'status': 'completed', 'invite': true, 'whatsapp': true, 'summary': 'Held in person. 39 of 42 families attended.',
      },
    ];

// ---------------------------------------------------------------- exam duties
List<Rec> _duties() {
  Rec d(String id, String code, String subject, String sub, int plus, String start, String end, String hall, String venue, String role, String partner, String partnerRole, int cands, String status,
          {String report = '', String swap = '', String swapWith = '', String? cls, String control = 'Control Room 102'}) =>
      {
        'id': id, 'code': code, 'subject': subject, 'sub': sub, 'date': plusDays(plus), 'start': start, 'end': end, 'hall': hall, 'venue': venue, 'role': role,
        'partner': partner, 'partnerRole': partnerRole, 'candidates': cands, 'status': status, 'report': report.isEmpty ? addMins(start, -30) : report, 'swap': swap, 'swapWith': swapWith,
        'cls': cls ?? 'Class 10', 'control': control, 'checked': <int>[], 'submitted': false, 'confirmed': true,
      };
  return [
    d('ed_1', 'EX-24-M10', 'Mathematics — Class 10', 'Set A & B • Term 2 Board Mock Exam', 1, '09:00', '12:00', 'Examination Hall 3', 'Block B (Floor 2) • Gate Entry 2B • Desks 01–42', 'Co-Invigilator', 'Mr. Rajesh Deshmukh', 'Co-Invigilator • PGT Physics', 42, 'upcoming'),
    d('ed_2', 'EX-24-S09', 'Science & Technology (Theory)', 'Term 2 Unit Exam', 4, '09:00', '12:00', 'Room 204', 'Class 9-A • Room 204', 'Co-Invigilator', 'Ms. Anjali Mehta', 'Co-Invigilator', 38, 'upcoming', cls: 'Class 9-A'),
    d('ed_3', 'EX-24-E10', 'English Language & Literature', 'Term 2 Unit Exam', 6, '09:00', '12:00', 'Hall 1', 'Class 10-C • Hall 1', 'Co-Invigilator', 'Mr. Ramesh Gupta', 'Co-Invigilator', 40, 'upcoming', swap: 'requested', swapWith: 'Ms. Anjali Mehta', cls: 'Class 10-C'),
    d('ed_4', 'EX-24-SS10', 'Social Science (Set C)', 'Term 2 Unit Exam', 9, '13:30', '16:30', 'Room 108', 'Class 10-B • Room 108 • Afternoon', 'Chief Invigilator', 'Self', 'Lead Chief Invigilator', 42, 'upcoming', cls: 'Class 10-B'),
    d('ed_5', 'EX-24-M09', 'Mathematics — Class 9', 'Unit Test 2', -7, '09:00', '11:00', 'Room 201', 'Class 9-A • Room 201', 'Co-Invigilator', 'Mr. Ramesh Gupta', 'Co-Invigilator', 38, 'completed', cls: 'Class 9-A'),
    d('ed_6', 'EX-24-P08', 'Physics — Class 8', 'Unit Test 1', -14, '10:00', '12:00', 'Room 118', 'Class 8-C • Room 118', 'Chief Invigilator', 'Self', 'Lead Chief Invigilator', 40, 'completed', cls: 'Class 8-C'),
  ];
}

List<Rec> _candidates() {
  final named = [
    ['Ananya Patel', 1, '10-A', 'present', ''], ['Aarav Sharma', 29, '10-B', 'present', ''], ['Dev Malhotra', 12, '10-B', 'absent', 'Medical Leave — Marked absent by Clinic (High Fever • Dr. S. Rao). Clinic Slip #MED-104 attached.'],
    ['Meera Iyer', 5, '10-A', 'present', ''], ['Rohan Verma', 19, '10-B', 'present', ''], ['Simran Kaur', 8, '10-A', 'absent', 'Sick Leave — Parent notified office at 08:45 AM. Formal absence request recorded in portal.'],
  ];
  final students = schoolSeed['students']!.where((s) => s['classId'] == 'cls_10B' || s['classId'] == 'cls_10A').toList();
  final rows = <Rec>[];
  const hallCls = {'ed_1': 42, 'ed_2': 38, 'ed_3': 40, 'ed_4': 42, 'ed_5': 38, 'ed_6': 40};
  hallCls.forEach((duty, count) {
    for (var n = 0; n < count; n++) {
      final isNamed = duty == 'ed_1' && n < named.length;
      final st = students[(n * 5 + duty.length) % students.length];
      final name = isNamed ? named[n][0] as String : st['name'] as String;
      final roll = isNamed ? named[n][1] as int : st['roll'] as int;
      final cls = isNamed ? named[n][2] as String : (st['classId'] == 'cls_10A' ? '10-A' : '10-B');
      rows.add({
        'id': 'edc_${duty}_${n + 1}', 'dutyId': duty, 'desk': 'D-${(n + 1).toString().padLeft(2, '0')}', 'seq': n + 1, 'set': n.isEven ? 'A' : 'B', 'name': name, 'roll': roll, 'cls': cls,
        'cbse': 'CBSE-24-${9941 + n * 2}', 'omr': 'AB-${89201 + n}', 'supp': duty == 'ed_1' && n == 1 ? 1 : 0, 'suppCode': duty == 'ed_1' && n == 1 ? 'SUP-4491' : '',
        'status': isNamed ? named[n][3] : 'present', 'absentReason': isNamed ? named[n][4] : '', 'malpractice': '',
      });
    }
  });
  return rows;
}

// ---------------------------------------------------------------- messages
List<Rec> _contacts() => [
      {'id': 'ct_priya', 'name': 'Mrs. Priya Sharma', 'role': 'Parent (10-B)', 'kind': 'parent', 'sub': 'Parent (Aarav - 10-B)', 'extra': 'Active 10 mins ago • Class 10-B Representative', 'online': true},
      {'id': 'ct_rao', 'name': 'Dr. K. V. Rao', 'role': 'Vice Principal', 'kind': 'staff', 'sub': 'Vice Principal', 'extra': 'Academic Coordination & Moderation', 'online': true},
      {'id': 'ct_rajesh', 'name': 'Mr. Rajesh Mehta', 'role': 'Parent (10-B)', 'kind': 'parent', 'sub': 'Parent (10-B)', 'extra': 'Father of Diya Mehta (Roll #18)', 'online': false},
      {'id': 'ct_sunita', 'name': 'Ms. Sunita (Science)', 'role': 'TCH-08', 'kind': 'staff', 'sub': 'TCH-08 • Faculty', 'extra': 'Physics Department Co-Lead', 'online': false},
      {'id': 'ct_bc10b', 'name': 'Class 10-B Parents', 'role': 'Broadcast Group', 'kind': 'broadcast', 'sub': 'Broadcast Group', 'extra': '42 Parent recipients • Announcements only', 'online': false},
      {'id': 'ct_vikram', 'name': 'Mr. Vikram Malhotra', 'role': 'Parent (10-B)', 'kind': 'parent', 'sub': 'Parent (10-B)', 'extra': 'Father of Dev Malhotra (Roll #12)', 'online': false},
    ];

Rec _m(String from, String sender, String text, int minsAgo, {Rec? attach, bool read = true}) => {'from': from, 'sender': sender, 'text': text, 'ts': _ago(minsAgo), 'attach': attach, 'read': read};

List<Rec> _threads() => [
      {
        'id': 'ms_1', 'key': 'ct_priya', 'name': 'Mrs. Priya Sharma', 'role': 'Parent (10-B)', 'kind': 'parent', 'pinned': false, 'online': true, 'unread': 0, 'subject': '', 'members': 0,
        'msgs': [
          _m('them', 'Mrs. Priya Sharma', "Namaste Anita Ma'am, hope you are well. Just wanted to ask if Aarav needs to bring the lab manual for tomorrow's practical session?", 190),
          _m('me', 'Me', 'Namaste Priya ji! Yes, please make sure he brings both the Physics journal and the graph sheet for the optics experiment.', 170),
          _m('them', 'Mrs. Priya Sharma', "Understood ma'am, I've packed both in his bag. Also, he has submitted the homework assignment on Quadratic Equations via the portal.", 120),
          _m('me', 'Me', 'Namaste Priya ji. Yes, he submitted it on time. I reviewed his worksheet and his steps are very clear. Keep encouraging him!', 60),
          _m('them', 'Mrs. Priya Sharma', 'Also sharing the advance slip for his dental appointment on Monday.', 12, attach: {'name': 'Medical Leave Note - 28 Oct.pdf', 'size': '142 KB'}),
          _m('me', 'Me', 'Namaste Priya ji. Yes, he submitted it today...', 8),
        ],
      },
      {
        'id': 'ms_2', 'key': 'ct_rao', 'name': 'Dr. K. V. Rao', 'role': 'Vice Principal', 'kind': 'staff', 'pinned': true, 'online': true, 'unread': 1, 'subject': 'Regarding Moderation for Term-1 Marks', 'members': 0,
        'msgs': [_m('them', 'Dr. K. V. Rao', 'Please cross-verify the grading sheets before 4 PM', 90, read: false)],
      },
      {
        'id': 'ms_3', 'key': 'ct_bc10b', 'name': 'Class 10-B Parent Broadcast', 'role': '42 members • Broadcast open', 'kind': 'broadcast', 'pinned': false, 'online': false, 'unread': 2, 'subject': '', 'members': 42,
        'msgs': [
          _m('me', 'Me', 'Reminder: the Term 2 Pre-Board Townhall is this Saturday at 10 AM.', 1500),
          _m('them', 'Mr. Verma', "Thank you Anita ma'am, we will be there.", 1440, read: false),
          _m('them', 'Mrs. Gupta', 'Will the deck be shared beforehand?', 1430, read: false),
        ],
      },
      {
        'id': 'ms_4', 'key': 'ct_sunita', 'name': 'Ms. Sunita (Science)', 'role': 'TCH-08', 'kind': 'staff', 'pinned': false, 'online': false, 'unread': 0, 'subject': '', 'members': 0,
        'msgs': [_m('them', 'Ms. Sunita (Science)', 'Shared the combined lab schedule', 1600, attach: {'name': 'Combined_Lab_Schedule.pdf', 'size': '310 KB'})],
      },
      {
        'id': 'ms_5', 'key': 'ct_rajesh', 'name': 'Mr. Rajesh Mehta', 'role': 'Parent (10-B)', 'kind': 'parent', 'pinned': false, 'online': false, 'unread': 0, 'subject': '', 'members': 0,
        'msgs': [_m('them', 'Mr. Rajesh Mehta', 'Will Aarav be attending the remedial math class?', 3000)],
      },
      {
        'id': 'ms_6', 'key': 'ct_vikram', 'name': 'Mr. Vikram Malhotra', 'role': 'Parent (10-B)', 'kind': 'parent', 'pinned': false, 'online': false, 'unread': 0, 'subject': 'Dev leave', 'members': 0,
        'msgs': [_m('them', 'Mr. Vikram Malhotra', 'Dev will be on medical leave for two days. Prescription attached on the portal.', 3300), _m('me', 'Me', 'Noted. Please send the slip when convenient.', 3290)],
      },
      {
        'id': 'ms_7', 'key': 'stu_101', 'name': 'Aarav Sharma', 'role': 'Student (10-B)', 'kind': 'student', 'pinned': false, 'online': false, 'unread': 0, 'subject': '', 'members': 0,
        'msgs': [_m('them', 'Aarav Sharma', 'Ma\'am, I have submitted worksheet #4.', 4400), _m('me', 'Me', 'Received, thank you Aarav.', 4380)],
      },
    ];

List<Rec> _drafts() => [
      {'id': 'md_1', 'to': ['ct_priya'], 'toLabel': 'Mrs. Priya Sharma', 'role': 'Parent(10-B)', 'sub': 'Mother of Aarav Sharma • Roll #01', 'kind': 'parent', 'category': 'Academic Query', 'subject': 'Term-2 Quadratic Equations Practice Worksheet & Doubt Session', 'body': 'Namaste Priya ji, Aarav did very well in today\'s formative assessment. Please share the attached practice worksheet with him.', 'ts': _ago(40), 'attach': <Rec>[]},
      {'id': 'md_2', 'to': ['ct_rajesh'], 'toLabel': 'Mr. Rajesh Deshmukh', 'role': 'Staff Direct', 'sub': 'Physics Faculty & Co-Invigilator', 'kind': 'staff', 'category': 'Urgent', 'subject': 'Exam Duty Handover & Strong Room Schedule', 'body': 'Hi Rajesh, Regarding tomorrow\'s 08:30 AM duty at Hall B, please collect the sealed packets from Room 102.', 'ts': _ago(1500), 'attach': <Rec>[]},
      {'id': 'md_3', 'to': ['ct_bc10b'], 'toLabel': 'Class 10-B Parents', 'role': 'Broadcast', 'sub': '42 Recipients • Official School Announcement', 'kind': 'broadcast', 'category': 'Fee / Admin', 'subject': 'Notice: Upcoming Parent-Teacher Townhall & Timing Slots', 'body': 'Dear Parents, Please note that the Term 2 Pre-Board townhall timings are as follows.', 'ts': _ago(2900), 'attach': <Rec>[]},
      {'id': 'md_4', 'to': ['ct_vikram'], 'toLabel': 'Mr. Vikram Malhotra', 'role': 'Parent(10-B)', 'sub': 'Father of Dev Malhotra • Roll #12', 'kind': 'parent', 'category': 'Attendance Notice', 'subject': 'Attendance shortfall', 'body': 'Dear Mr. Malhotra, Dev\'s attendance this month needs attention.', 'ts': _ago(4300), 'attach': <Rec>[]},
    ];

final Seed engageSeed = {
  'lv_sessions': _live(),
  'lm_my': _myLeaves(),
  'lm_balance': [
    {'id': 'lb_1', 'type': 'Casual Leave', 'total': 12},
    {'id': 'lb_2', 'type': 'Medical Leave', 'total': 10},
    {'id': 'lb_3', 'type': 'Special Duty Leave', 'total': 5},
    {'id': 'lb_4', 'type': 'Academic Workshop', 'total': 6},
  ],
  'lm_student': _studentLeaves(),
  'pm_meetings': _meetings(),
  ...meetingRoomRows('pm_1'),
  'ed_duties': _duties(),
  'ed_candidates': _candidates(),
  'ms_contacts': _contacts(),
  'ms_messages': _threads(),
  'ms_drafts': _drafts(),
};
