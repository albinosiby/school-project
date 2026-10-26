import '../modules/attendance/models/attendance_models.dart';
import '../modules/family/models/family_models.dart';
import '../modules/fees/models/fee_models.dart';
import '../modules/homework/models/homework_models.dart';
import '../modules/leave/models/leave_models.dart';
import '../modules/live_classes/models/live_class_models.dart';
import '../modules/marks/models/marks_models.dart';
import '../modules/messages/models/message_models.dart';
import '../modules/notices/models/notice_models.dart';
import '../modules/timetable/models/timetable_models.dart';
import '../utils/helpers/date_helper.dart';

/// Demo data for the Greenfield International School demo family.
/// Dates are relative to "now" so the demo always has a today, an overdue item and a joinable class.
class DemoData {
  DemoData._();

  static const demoEmail = 'rajesh.sharma@example.com';
  static const demoPassword = 'parent123';

  static const guardian = Guardian(
    id: 'par_001',
    name: 'Mr. Rajesh Sharma',
    email: demoEmail,
    phone: '+91 98765 43210',
    relation: 'Father',
  );

  static const aarav = Child(
    id: 'stu_aarav',
    name: 'Aarav Sharma',
    grade: '10',
    section: 'B',
    rollNo: 14,
    admissionNo: 'GIS-2021-0142',
    classTeacher: 'Mrs. Anita Sharma',
  );
  static const ananya = Child(
    id: 'stu_ananya',
    name: 'Ananya Sharma',
    grade: '8',
    section: 'C',
    rollNo: 27,
    admissionNo: 'GIS-2023-0318',
    classTeacher: 'Mr. Vikram Nair',
  );

  static const family = Family(guardian: guardian, children: [aarav, ananya]);

  static Child childById(String id) =>
      family.children.firstWhere((c) => c.id == id, orElse: () => aarav);
  static bool _isAarav(String childId) => childId == aarav.id;

  // ---- Timetable -----------------------------------------------------------------------------
  static const _slots = [
    (510, 550),
    (550, 590),
    (590, 630),
    (645, 685),
    (685, 725),
    (725, 765),
    (780, 820),
  ]; // 08:30 .. 13:40 (break 10:30, lunch 12:45)

  static const _aaravWeek = [
    ['Mathematics', 'Mrs. Anita Sharma', 'R-204'],
    ['English', 'Ms. Priya Menon', 'R-204'],
    ['Science', 'Mrs. Anita Sharma', 'Lab-2'],
    ['Social Science', 'Mr. Joseph Mathew', 'R-204'],
    ['Hindi', 'Mrs. Kavita Rao', 'R-204'],
    ['Computer Science', 'Mr. Imran Khan', 'IT Lab'],
    ['Physical Education', 'Mr. Daniel George', 'Ground'],
  ];
  static const _ananyaWeek = [
    ['English', 'Ms. Priya Menon', 'R-108'],
    ['Mathematics', 'Mr. Suresh Pillai', 'R-108'],
    ['Physics', 'Mrs. Anita Sharma', 'Lab-1'],
    ['Social Science', 'Mr. Joseph Mathew', 'R-108'],
    ['Hindi', 'Mrs. Kavita Rao', 'R-108'],
    ['Art', 'Ms. Leena Thomas', 'Art Room'],
    ['Library', 'Mr. Vikram Nair', 'Library'],
  ];

  static TimetableWeek timetable(String childId) {
    final rows = _isAarav(childId) ? _aaravWeek : _ananyaWeek;
    final periods = <Period>[];
    for (var day = DateTime.monday; day <= DateTime.friday; day++) {
      for (var i = 0; i < _slots.length; i++) {
        final r =
            rows[(i + day - 1) %
                rows.length]; // rotate subjects through the week
        periods.add(
          Period(
            weekday: day,
            startMinute: _slots[i].$1,
            endMinute: _slots[i].$2,
            subject: r[0],
            teacher: r[1],
            room: r[2],
          ),
        );
      }
    }
    return TimetableWeek(periods);
  }

  // ---- Attendance (a term, ending yesterday; today for Aarav only) -----------------------------
  static AttendanceData attendance(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    final seed = _isAarav(childId) ? 7 : 11;
    final records = <AttendanceRecord>[];
    for (var back = 120; back >= 1; back--) {
      final d = t.subtract(Duration(days: back));
      if (d.weekday > DateTime.friday) continue;
      final k = (back * seed + d.day) % 29;
      AttendanceRecord r;
      if (back == 21) {
        r = AttendanceRecord(
          date: d,
          status: AttendanceStatus.holiday,
          note: 'Teachers\' Day holiday',
        );
      } else if (k == 0) {
        r = AttendanceRecord(
          date: d,
          status: AttendanceStatus.absent,
          note: 'Fever',
        );
      } else if (k == 13 && back > 3) {
        r = AttendanceRecord(
          date: d,
          status: AttendanceStatus.leave,
          note: 'Family function (approved leave)',
        );
      } else if (k == 5 || k == 19) {
        r = AttendanceRecord(
          date: d,
          status: AttendanceStatus.late,
          note: 'Arrived 08:55',
        );
      } else if (k == 9) {
        r = AttendanceRecord(
          date: d,
          status: AttendanceStatus.halfDay,
          note: 'Left early (dentist)',
        );
      } else {
        r = AttendanceRecord(date: d, status: AttendanceStatus.present);
      }
      records.add(r);
    }
    // Today: Aarav is already marked present; Ananya is "not marked yet".
    if (_isAarav(childId) && t.weekday <= DateTime.friday) {
      records.add(AttendanceRecord(date: t, status: AttendanceStatus.present));
    }
    return AttendanceData(records);
  }

  // ---- Homework -------------------------------------------------------------------------------
  static List<Homework> homework(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    if (_isAarav(childId)) {
      return [
        Homework(
          id: 'hw_a1',
          subject: 'Mathematics',
          title: 'Quadratic equations - Exercise 4.2',
          description:
              'Solve questions 1 to 12 from Exercise 4.2. Show every step and box the final answers.',
          assignedOn: plusDays(-2, from: t),
          due: t,
          teacher: 'Mrs. Anita Sharma',
          attachments: const ['Exercise_4_2.pdf'],
        ),
        Homework(
          id: 'hw_a2',
          subject: 'Science',
          title: 'Chemical reactions - lab record',
          description:
              'Complete the lab record for Experiment 3 (reaction of metals with acids). Draw labelled diagrams.',
          assignedOn: plusDays(-3, from: t),
          due: plusDays(1, from: t),
          teacher: 'Mrs. Anita Sharma',
        ),
        Homework(
          id: 'hw_a3',
          subject: 'English',
          title: 'Letter to the editor',
          description:
              'Write a formal letter (150 words) on the problem of plastic waste in your neighbourhood.',
          assignedOn: plusDays(-1, from: t),
          due: plusDays(3, from: t),
          teacher: 'Ms. Priya Menon',
        ),
        Homework(
          id: 'hw_a4',
          subject: 'Social Science',
          title: 'Map work - rivers of India',
          description:
              'Mark and label the major rivers on the outline map given in class.',
          assignedOn: plusDays(-6, from: t),
          due: plusDays(-2, from: t),
          teacher: 'Mr. Joseph Mathew',
        ),
        Homework(
          id: 'hw_a5',
          subject: 'Hindi',
          title: 'Nibandh - Mere sapno ka bharat',
          description: 'Write an essay of about 200 words.',
          assignedOn: plusDays(-8, from: t),
          due: plusDays(-4, from: t),
          teacher: 'Mrs. Kavita Rao',
          submitted: true,
        ),
        Homework(
          id: 'hw_a6',
          subject: 'Computer Science',
          title: 'Python programs 5 to 8',
          description: 'Write and test the programs in your notebook.',
          assignedOn: plusDays(-12, from: t),
          due: plusDays(-7, from: t),
          teacher: 'Mr. Imran Khan',
          submitted: true,
          reviewed: true,
          score: '9/10',
          remark: 'Neat code and good comments. Handle empty input next time.',
        ),
      ];
    }
    return [
      Homework(
        id: 'hw_n1',
        subject: 'Mathematics',
        title: 'Linear equations worksheet',
        description: 'Complete worksheet 6 (both sides).',
        assignedOn: plusDays(-1, from: t),
        due: plusDays(1, from: t),
        teacher: 'Mr. Suresh Pillai',
        attachments: const ['Worksheet_6.pdf'],
      ),
      Homework(
        id: 'hw_n2',
        subject: 'Physics',
        title: 'Motion - numericals',
        description:
            'Solve the 10 numericals on speed, velocity and acceleration.',
        assignedOn: plusDays(-2, from: t),
        due: plusDays(2, from: t),
        teacher: 'Mrs. Anita Sharma',
      ),
      Homework(
        id: 'hw_n3',
        subject: 'English',
        title: 'Book review',
        description: 'Write a one-page review of the book you read this month.',
        assignedOn: plusDays(-9, from: t),
        due: plusDays(-3, from: t),
        teacher: 'Ms. Priya Menon',
        submitted: true,
        reviewed: true,
        score: 'A',
        remark: 'Lovely expression. Add a rating next time.',
      ),
      Homework(
        id: 'hw_n4',
        subject: 'Art',
        title: 'Poster - save water',
        description: 'Make a poster on A3 sheet with colours of your choice.',
        assignedOn: plusDays(-7, from: t),
        due: plusDays(-1, from: t),
        teacher: 'Ms. Leena Thomas',
      ),
    ];
  }

  // ---- Marks ----------------------------------------------------------------------------------
  static List<ExamResult> exams(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    if (_isAarav(childId)) {
      return [
        ExamResult(
          id: 'ex_a3',
          name: 'Term 1 Final Exam',
          date: plusDays(25, from: t),
        ),
        ExamResult(
          id: 'ex_a2',
          name: 'Mid-Term Exam',
          date: plusDays(-32, from: t),
          rank: 6,
          classSize: 42,
          remarks: 'Good progress. Practise word problems in Mathematics.',
          subjects: const [
            SubjectMark(subject: 'English', obtained: 81, max: 100),
            SubjectMark(subject: 'Mathematics', obtained: 92, max: 100),
            SubjectMark(subject: 'Science', obtained: 88, max: 100),
            SubjectMark(subject: 'Social Science', obtained: 76, max: 100),
            SubjectMark(subject: 'Hindi', obtained: 72, max: 100),
            SubjectMark(subject: 'Computer Science', obtained: 47, max: 50),
          ],
        ),
        ExamResult(
          id: 'ex_a1',
          name: 'Unit Test 1',
          date: plusDays(-70, from: t),
          rank: 9,
          classSize: 42,
          remarks: 'Satisfactory. Keep it up.',
          subjects: const [
            SubjectMark(subject: 'English', obtained: 38, max: 50),
            SubjectMark(subject: 'Mathematics', obtained: 44, max: 50),
            SubjectMark(subject: 'Science', obtained: 41, max: 50),
            SubjectMark(subject: 'Social Science', obtained: 35, max: 50),
            SubjectMark(subject: 'Hindi', obtained: 36, max: 50),
          ],
        ),
      ];
    }
    return [
      ExamResult(
        id: 'ex_n2',
        name: 'Mid-Term Exam',
        date: plusDays(-30, from: t),
        rank: 4,
        classSize: 40,
        remarks: 'Excellent effort. Keep reading widely.',
        subjects: const [
          SubjectMark(subject: 'English', obtained: 90, max: 100),
          SubjectMark(subject: 'Mathematics', obtained: 78, max: 100),
          SubjectMark(subject: 'Physics', obtained: 84, max: 100),
          SubjectMark(subject: 'Social Science', obtained: 86, max: 100),
          SubjectMark(subject: 'Hindi', obtained: 80, max: 100),
          SubjectMark(subject: 'Art', obtained: 48, max: 50),
        ],
      ),
      ExamResult(
        id: 'ex_n1',
        name: 'Unit Test 1',
        date: plusDays(-68, from: t),
        rank: 7,
        classSize: 40,
        subjects: const [
          SubjectMark(subject: 'English', obtained: 43, max: 50),
          SubjectMark(subject: 'Mathematics', obtained: 36, max: 50),
          SubjectMark(subject: 'Physics', obtained: 40, max: 50),
          SubjectMark(subject: 'Social Science', obtained: 42, max: 50),
        ],
      ),
    ];
  }

  // ---- Notices ---------------------------------------------------------------------------------
  static List<Notice> notices(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    return [
      Notice(
        id: 'nt_1',
        title: 'Parent-teacher meeting this Saturday',
        body:
            'The Term 1 parent-teacher meeting will be held on Saturday from 9:00 AM to 12:30 PM. Please confirm that you have seen this notice and collect the report card from the class teacher.',
        date: t,
        from: 'Principal\'s office',
        category: NoticeCategory.event,
        requiresAck: true,
      ),
      Notice(
        id: 'nt_2',
        title: 'Term 1 exam schedule published',
        body:
            'The Term 1 Final Exam begins in the coming weeks. The detailed date sheet is available with the class teacher and in the Learn tab.',
        date: plusDays(-1, from: t),
        from: 'Examination cell',
        category: NoticeCategory.exam,
      ),
      Notice(
        id: 'nt_3',
        title: 'School closed for Diwali holidays',
        body:
            'The school will remain closed from Monday to Wednesday for Diwali. Classes resume on Thursday. Wishing you and your family a happy Diwali.',
        date: plusDays(-3, from: t),
        from: 'Administration',
        category: NoticeCategory.holiday,
      ),
      Notice(
        id: 'nt_4',
        title: 'Bus route 6 delayed due to road work',
        body:
            'Bus route 6 will run 15 minutes late until further notice because of road work near the main junction.',
        date: plusDays(-4, from: t),
        from: 'Transport desk',
        category: NoticeCategory.urgent,
      ),
      Notice(
        id: 'nt_5',
        title: 'Annual sports day - consent form',
        body:
            'Students taking part in the annual sports day need a signed consent form. Please acknowledge to give consent for participation.',
        date: plusDays(-6, from: t),
        from: 'Sports department',
        category: NoticeCategory.event,
        requiresAck: true,
      ),
      Notice(
        id: 'nt_6',
        title: 'Library week',
        body:
            'Library week starts next Monday. Students may borrow up to three books and bring their library cards.',
        date: plusDays(-9, from: t),
        from: 'Library',
        category: NoticeCategory.general,
      ),
    ];
  }

  // ---- Live classes ----------------------------------------------------------------------------
  static List<LiveClass> liveClasses(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final tomorrow4pm = DateTime(n.year, n.month, n.day + 1, 16);
    final aarav = _isAarav(childId);
    return [
      LiveClass(
        id: aarav ? 'lv_a1' : 'lv_n1',
        title: aarav
            ? 'Algebra revision: quadratic equations'
            : 'Motion and speed - doubt clearing',
        subject: aarav ? 'Mathematics' : 'Physics',
        teacher: 'Mrs. Anita Sharma',
        start: n.add(const Duration(minutes: 5)),
        mins: 45,
        link: 'https://meet.google.com/abc-defg-hij',
      ),
      LiveClass(
        id: aarav ? 'lv_a2' : 'lv_n2',
        title: aarav ? 'Chemical reactions - lab demo' : 'Poetry appreciation',
        subject: aarav ? 'Science' : 'English',
        teacher: aarav ? 'Mrs. Anita Sharma' : 'Ms. Priya Menon',
        start: tomorrow4pm,
        mins: 40,
        link: 'https://meet.google.com/klm-nopq-rst',
      ),
      LiveClass(
        id: aarav ? 'lv_a3' : 'lv_n3',
        title: aarav ? 'Essay writing workshop' : 'Fractions revisited',
        subject: aarav ? 'English' : 'Mathematics',
        teacher: aarav ? 'Ms. Priya Menon' : 'Mr. Suresh Pillai',
        start: DateTime(n.year, n.month, n.day - 1, 16),
        mins: 40,
        link: 'https://meet.google.com/uvw-xyza-bcd',
      ),
    ];
  }

  // ---- Leave -----------------------------------------------------------------------------------
  static List<LeaveRequest> leaves(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    return [
      LeaveRequest(
        id: 'lv_${childId}_2',
        childId: childId,
        from: plusDays(-18, from: t),
        to: plusDays(-17, from: t),
        reason: 'Family function out of town',
        appliedOn: plusDays(-22, from: t),
        status: LeaveStatus.approved,
        reviewerNote: 'Approved. Please collect the notes.',
      ),
      LeaveRequest(
        id: 'lv_${childId}_1',
        childId: childId,
        from: plusDays(-50, from: t),
        to: plusDays(-50, from: t),
        reason: 'Dental appointment',
        appliedOn: plusDays(-52, from: t),
        status: LeaveStatus.rejected,
        reviewerNote: 'Exam day: please reschedule.',
      ),
    ];
  }

  // ---- Messages --------------------------------------------------------------------------------
  static List<MessageThread> threads(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final aarav = _isAarav(childId);
    return [
      MessageThread(
        id: 'th_${childId}_ct',
        childId: childId,
        teacher: aarav ? 'Mrs. Anita Sharma' : 'Mr. Vikram Nair',
        role: 'Class teacher',
        lastMessage: 'Thank you, I will keep an eye on it.',
        lastAt: n.subtract(const Duration(hours: 3)),
        unread: 1,
      ),
      MessageThread(
        id: 'th_${childId}_st',
        childId: childId,
        teacher: aarav ? 'Mr. Imran Khan' : 'Ms. Priya Menon',
        role: aarav ? 'Computer Science' : 'English',
        lastMessage: 'Project submission has been extended by two days.',
        lastAt: n.subtract(const Duration(days: 2)),
      ),
    ];
  }

  static List<ChatMessage> chat(String threadId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final classTeacher = threadId.endsWith('_ct');
    if (classTeacher) {
      return [
        ChatMessage(
          id: '${threadId}_1',
          threadId: threadId,
          fromParent: true,
          text:
              'Good morning, ma\'am. Could you share how my child is doing in class this month?',
          at: n.subtract(const Duration(hours: 5)),
        ),
        ChatMessage(
          id: '${threadId}_2',
          threadId: threadId,
          fromParent: false,
          text:
              'Good morning Mr. Sharma. Very good participation. Needs a little more practice with word problems.',
          at: n.subtract(const Duration(hours: 4)),
        ),
        ChatMessage(
          id: '${threadId}_3',
          threadId: threadId,
          fromParent: true,
          text: 'Thank you, I will keep an eye on it.',
          at: n.subtract(const Duration(hours: 3)),
        ),
      ];
    }
    return [
      ChatMessage(
        id: '${threadId}_1',
        threadId: threadId,
        fromParent: true,
        text: 'Is the project deadline still Friday?',
        at: n.subtract(const Duration(days: 2, hours: 1)),
      ),
      ChatMessage(
        id: '${threadId}_2',
        threadId: threadId,
        fromParent: false,
        text: 'Project submission has been extended by two days.',
        at: n.subtract(const Duration(days: 2)),
      ),
    ];
  }

  // ---- Fees ------------------------------------------------------------------------------------
  static FeesData fees(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    final aarav = _isAarav(childId);
    return FeesData([
      Invoice(
        id: 'inv_${childId}_t1',
        title: 'Term 1 fee',
        issued: plusDays(-95, from: t),
        due: plusDays(-80, from: t),
        paid: aarav ? 42500 : 36500,
        items: [
          FeeItem('Tuition', aarav ? 32000 : 27000),
          const FeeItem('Activity fee', 4500),
          const FeeItem('Lab and library', 6000),
        ],
      ),
      Invoice(
        id: 'inv_${childId}_bus',
        title: 'Transport - Q2',
        issued: plusDays(-20, from: t),
        due: plusDays(-5, from: t),
        paid: 0,
        items: const [FeeItem('Bus route 6', 9000)],
      ),
      Invoice(
        id: 'inv_${childId}_t2',
        title: 'Term 2 fee',
        issued: plusDays(-2, from: t),
        due: plusDays(28, from: t),
        paid: 0,
        items: [
          FeeItem('Tuition', aarav ? 32000 : 27000),
          const FeeItem('Activity fee', 4500),
          const FeeItem('Lab and library', 6000),
        ],
      ),
    ]);
  }
}
