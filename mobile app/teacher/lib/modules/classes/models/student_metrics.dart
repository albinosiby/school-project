import '../../school/models/school_models.dart';
import 'classes_models.dart';

/// Deterministic, derived student metrics (scores, rank, attendance split, merits) used by the
/// classes & students screens. Pure functions so they are easy to test.

String clsName(SchoolClass c) => '${c.grade}-${c.section}';
String clsLong(SchoolClass c) => '${c.grade}–${c.section}';
String rollTag(Student s) => '#${s.roll.toString().padLeft(2, '0')}';
int _idx(Student s) => int.tryParse(s.id.replaceAll('stu_', '')) ?? 0;

/// The class the teacher is class teacher of, else the first one.
SchoolClass? defaultClass(List<SchoolClass> classes) =>
    classes.isEmpty ? null : classes.firstWhere((c) => c.classTeacher, orElse: () => classes.first);

SchoolClass? classOr(List<SchoolClass> classes, String? id) => classes.where((c) => c.id == id).firstOrNull ?? defaultClass(classes);

String subjectCode(SchoolClass c) {
  final w = c.subject.split(' ').where((e) => e.isNotEmpty).toList();
  if (w.length > 1) return w.map((e) => e[0]).join().toUpperCase();
  return c.subject.substring(0, c.subject.length < 4 ? c.subject.length : 4).toUpperCase();
}

typedef SubjectDef = ({String name, String teacher, String role});
const subjectDefs = <SubjectDef>[
  (name: 'Mathematics (Advanced)', teacher: 'Mrs. Anita Sharma', role: 'Head of Dept'),
  (name: 'Science & Physics', teacher: 'Dr. S. K. Nambiar', role: 'Senior Faculty'),
  (name: 'English Literature', teacher: 'Ms. Clara Joseph', role: 'Language Lead'),
  (name: 'Social Science & History', teacher: 'Mr. Rajesh Deshmukh', role: 'Humanities'),
];

int subjectScore(Student s, int i) => 64 + ((_idx(s) * 37 + i * 23) % 35);
double avgScore(Student s) => [for (var i = 0; i < subjectDefs.length; i++) subjectScore(s, i)].reduce((a, b) => a + b) / subjectDefs.length;
String gradeOf(num pct) => pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : 'C';

/// Rank within [classmates] by average score (ties share the better rank).
int rankIn(List<Student> classmates, Student s) {
  final mine = avgScore(s);
  return 1 + classmates.where((o) => o.classId == s.classId && avgScore(o) > mine).length;
}

String todayStatus(Student s) {
  final r = s.roll;
  if (r % 21 == 8) return 'Absent';
  if (r % 14 == 0 && r % 28 != 0) return 'On Leave';
  return 'Present';
}

const _tags = ['Prefect', 'Top Ranker', 'Sports Capt', 'Arts Sec', 'Peer Tutor', 'Olympiad'];
String tagOf(Student s) => _tags[(s.roll - 1) % _tags.length];

List<BehaviourLog> logsFor(List<BehaviourLog> logs, String studentId) => [for (final l in logs) if (l.studentId == studentId) l];
int meritsOf(Student s, List<BehaviourLog> logs) =>
    20 + (_idx(s) * 7) % 20 + logsFor(logs, s.id).where((l) => l.kind == 'praise').fold<int>(0, (a, l) => a + l.merits);
int flagsOf(Student s, List<BehaviourLog> logs) => logsFor(logs, s.id).where((l) => l.kind == 'flag').length;

({int present, int absent, int leave, int total}) attendanceSplit(Student s) {
  const total = 140;
  final present = (total * s.attendance / 100).round();
  final rest = total - present;
  final absent = (rest * 0.6).round();
  return (present: present, absent: absent, leave: rest - absent, total: total);
}

/// Second guardian contact derived from the primary one.
({String name, String phone}) secondGuardian(Student s) {
  final last = s.name.split(' ').last;
  final digits = s.phone.replaceAll(RegExp(r'\D'), '');
  final alt = digits.isEmpty ? '' : '+${digits.substring(0, digits.length - 1)}${(int.parse(digits[digits.length - 1]) + 1) % 10}';
  return (name: 'Mrs. $last', phone: alt.length > 3 ? alt : s.phone);
}

/// Attendance status for a day of November 2024 (deterministic per student).
String calendarStatus(Student s, int day) {
  final wd = DateTime(2024, 11, day).weekday;
  if (wd >= 6) return 'off';
  final h = (day * 31 + _idx(s) * 17) % 100;
  if (h >= s.attendance) return h % 3 == 0 ? 'leave' : 'absent';
  return 'present';
}

int attendanceStreak(Student s) => 10 + (_idx(s) * 13) % 40;
