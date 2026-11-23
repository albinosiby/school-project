import 'package:equatable/equatable.dart';

/// The signed-in teacher.
class Teacher extends Equatable {
  const Teacher({
    required this.id,
    required this.name,
    required this.short,
    required this.title,
    required this.subjects,
    required this.designation,
    required this.empId,
    required this.school,
    required this.year,
    required this.term,
    required this.email,
    required this.phone,
    required this.joined,
    this.subjectNames = const [],
    this.photo = '',
    this.status = '',
    this.logo = '',
  });
  final List<String> subjectNames;
  final String id, name, short, title, subjects, designation, empId, school, year, term, email, phone, joined;
  /// Profile photo as a JPEG data URL from staff_hr_photos, '' when the office has not uploaded one.
  final String photo;
  /// Employment status from the staff record (Active, On Leave…); '' when unknown.
  final String status;
  /// The school's logo URL from the school settings, '' when none was uploaded.
  final String logo;

  factory Teacher.fromJson(Map<String, dynamic> j) => Teacher(
    id: j['id'] as String? ?? 'me',
    name: j['name'] as String? ?? '',
    short: j['short'] as String? ?? '',
    title: j['title'] as String? ?? '',
    subjectNames: [for (final value in j['subjectNames'] as List? ?? const []) '$value'],
    subjects: j['subjects'] as String? ?? '',
    designation: j['designation'] as String? ?? '',
    empId: j['empId'] as String? ?? '',
    school: j['school'] as String? ?? '',
    year: j['year'] as String? ?? '',
    term: j['term'] as String? ?? '',
    email: j['email'] as String? ?? '',
    photo: j['photo'] as String? ?? '',
    status: j['status'] as String? ?? '',
    logo: j['logo'] as String? ?? '',
    phone: j['phone'] as String? ?? '',
    joined: j['joined'] as String? ?? '',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'short': short,
    'title': title,
    'subjects': subjects,
    'subjectNames': subjectNames,
    'designation': designation,
    'empId': empId,
    'school': school,
    'year': year,
    'term': term,
    'email': email,
    'photo': photo,
    'status': status,
    'logo': logo,
    'phone': phone,
    'joined': joined,
  };
  Teacher copyWith({String? name, String? email, String? phone}) =>
      Teacher.fromJson({...toJson(), 'name': ?name, 'email': ?email, 'phone': ?phone});

  @override
  List<Object?> get props => [id, name, short, title, subjects, subjectNames, designation, empId, school, year, term, email, phone, joined, photo, status, logo];
}

/// A class/section the teacher teaches.
class SchoolClass extends Equatable {
  const SchoolClass({
    required this.id,
    required this.grade,
    required this.section,
    required this.subject,
    required this.topic,
    required this.room,
    required this.wing,
    required this.students,
    required this.classTeacher,
    required this.rep,
    required this.attendance,
    this.subjectNames = const [],
    this.displayLabel = '',
  });
  final String id, grade, section, subject, topic, room, wing, rep, displayLabel;
  final List<String> subjectNames;
  final int students;
  final bool classTeacher;
  final double attendance;

  String get label => displayLabel.isEmpty ? '$grade-$section' : displayLabel;
  String get title => 'Grade $grade – Section $section';

  factory SchoolClass.fromJson(Map<String, dynamic> j) => SchoolClass(
    id: j['id'] as String,
    grade: '${j['grade']}',
    section: '${j['section']}',
    subject: j['subject'] as String? ?? '',
    subjectNames: [for (final value in j['subjects'] as List? ?? const []) '$value'],
    displayLabel: '${j['label'] ?? ''}',
    topic: j['topic'] as String? ?? '',
    room: j['room'] as String? ?? '',
    wing: j['wing'] as String? ?? '',
    students: (j['students'] as num?)?.toInt() ?? 0,
    classTeacher: j['classTeacher'] == true,
    rep: j['rep'] as String? ?? '',
    attendance: (j['attendance'] as num?)?.toDouble() ?? 0,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'grade': grade,
    'section': section,
    'subject': subject,
    'subjects': subjectNames,
    'label': displayLabel,
    'topic': topic,
    'room': room,
    'wing': wing,
    'students': students,
    'classTeacher': classTeacher,
    'rep': rep,
    'attendance': attendance,
  };

  @override
  List<Object?> get props => [id, grade, section, subject, subjectNames, displayLabel, students, attendance, classTeacher];
}

class Student extends Equatable {
  const Student({
    required this.id,
    required this.name,
    required this.roll,
    required this.classId,
    required this.adm,
    required this.guardian,
    required this.phone,
    required this.attendance,
    required this.grade,
    this.admissionDate = '',
  });
  final String id, name, classId, adm, guardian, phone, grade, admissionDate;
  final int roll;
  final double attendance;

  factory Student.fromJson(Map<String, dynamic> j) => Student(
    admissionDate: '${j['admissionDate'] ?? ''}',
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    roll: (j['roll'] as num?)?.toInt() ?? 0,
    classId: j['classId'] as String? ?? '',
    adm: j['adm'] as String? ?? '',
    guardian: j['guardian'] as String? ?? '',
    phone: j['phone'] as String? ?? '',
    attendance: (j['attendance'] as num?)?.toDouble() ?? 0,
    grade: j['grade'] as String? ?? '',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'roll': roll,
    'classId': classId,
    'adm': adm,
    'guardian': guardian,
    'phone': phone,
    'attendance': attendance,
    'admissionDate': admissionDate,
    'grade': grade,
  };

  @override
  List<Object?> get props => [id, name, roll, classId, attendance, grade, admissionDate];
}
