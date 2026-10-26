import 'package:equatable/equatable.dart';

/// The signed-in teacher.
class Teacher extends Equatable {
  const Teacher({required this.id, required this.name, required this.short, required this.title, required this.subjects, required this.designation, required this.empId, required this.school, required this.year, required this.term, required this.email, required this.phone, required this.joined});
  final String id, name, short, title, subjects, designation, empId, school, year, term, email, phone, joined;

  factory Teacher.fromJson(Map<String, dynamic> j) => Teacher(
        id: j['id'] as String? ?? 'me', name: j['name'] as String? ?? '', short: j['short'] as String? ?? '', title: j['title'] as String? ?? '',
        subjects: j['subjects'] as String? ?? '', designation: j['designation'] as String? ?? '', empId: j['empId'] as String? ?? '',
        school: j['school'] as String? ?? '', year: j['year'] as String? ?? '', term: j['term'] as String? ?? '', email: j['email'] as String? ?? '',
        phone: j['phone'] as String? ?? '', joined: j['joined'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'short': short, 'title': title, 'subjects': subjects, 'designation': designation, 'empId': empId, 'school': school, 'year': year, 'term': term, 'email': email, 'phone': phone, 'joined': joined};
  Teacher copyWith({String? name, String? email, String? phone}) =>
      Teacher.fromJson({...toJson(), 'name': ?name, 'email': ?email, 'phone': ?phone});

  @override
  List<Object?> get props => [id, name, short, title, subjects, designation, empId, school, year, term, email, phone, joined];
}

/// A class/section the teacher teaches.
class SchoolClass extends Equatable {
  const SchoolClass({required this.id, required this.grade, required this.section, required this.subject, required this.topic, required this.room, required this.wing, required this.students, required this.classTeacher, required this.rep, required this.attendance});
  final String id, grade, section, subject, topic, room, wing, rep;
  final int students;
  final bool classTeacher;
  final double attendance;

  String get label => '$grade-$section';
  String get title => 'Grade $grade – Section $section';

  factory SchoolClass.fromJson(Map<String, dynamic> j) => SchoolClass(
        id: j['id'] as String, grade: '${j['grade']}', section: '${j['section']}', subject: j['subject'] as String? ?? '', topic: j['topic'] as String? ?? '',
        room: j['room'] as String? ?? '', wing: j['wing'] as String? ?? '', students: (j['students'] as num?)?.toInt() ?? 0,
        classTeacher: j['classTeacher'] == true, rep: j['rep'] as String? ?? '', attendance: (j['attendance'] as num?)?.toDouble() ?? 0,
      );
  Map<String, dynamic> toJson() => {'id': id, 'grade': grade, 'section': section, 'subject': subject, 'topic': topic, 'room': room, 'wing': wing, 'students': students, 'classTeacher': classTeacher, 'rep': rep, 'attendance': attendance};

  @override
  List<Object?> get props => [id, grade, section, subject, students, attendance];
}

class Student extends Equatable {
  const Student({required this.id, required this.name, required this.roll, required this.classId, required this.adm, required this.guardian, required this.phone, required this.attendance, required this.grade});
  final String id, name, classId, adm, guardian, phone, grade;
  final int roll, attendance;

  factory Student.fromJson(Map<String, dynamic> j) => Student(
        id: j['id'] as String, name: j['name'] as String? ?? '', roll: (j['roll'] as num?)?.toInt() ?? 0, classId: j['classId'] as String? ?? '',
        adm: j['adm'] as String? ?? '', guardian: j['guardian'] as String? ?? '', phone: j['phone'] as String? ?? '',
        attendance: (j['attendance'] as num?)?.toInt() ?? 0, grade: j['grade'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'roll': roll, 'classId': classId, 'adm': adm, 'guardian': guardian, 'phone': phone, 'attendance': attendance, 'grade': grade};

  @override
  List<Object?> get props => [id, name, roll, classId, attendance, grade];
}
