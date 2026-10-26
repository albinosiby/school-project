import 'package:equatable/equatable.dart';

/// Subject groups used by the "Subject Faculty" filter chips (Figma 5.6).
enum TeacherCategory {
  coreSciences('Core Sciences'),
  languages('Languages'),
  electives('Electives');

  const TeacherCategory(this.label);
  final String label;
}

/// One teacher of the selected child (timetable subject teachers + class teacher).
class Teacher extends Equatable {
  const Teacher({
    required this.id,
    required this.name,
    required this.subject,
    required this.designation,
    required this.room,
    required this.category,
    required this.phone,
    required this.email,
    required this.officeHours,
    required this.threadId,
    this.qualification,
    this.isClassTeacher = false,
  });

  final String id, name, subject, designation, room, phone, email, officeHours;

  /// Message thread with this teacher for the child (existing or new).
  final String threadId;
  final String? qualification;
  final TeacherCategory category;
  final bool isClassTeacher;

  String get displayName =>
      qualification == null ? name : '$name, $qualification';

  /// Role shown in the chat header.
  String get role => isClassTeacher ? 'Class teacher' : subject;

  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return name.toLowerCase().contains(q) ||
        subject.toLowerCase().contains(q) ||
        designation.toLowerCase().contains(q) ||
        room.toLowerCase().contains(q);
  }

  @override
  List<Object?> get props => [
    id,
    name,
    subject,
    designation,
    room,
    category,
    phone,
    email,
    officeHours,
    threadId,
    qualification,
    isClassTeacher,
  ];
}

/// Teachers of one child: the class teacher and every subject teacher (class teacher included).
class TeachersData extends Equatable {
  const TeachersData({
    required this.className,
    required this.classTeacher,
    required this.faculty,
    required this.receptionPhone,
  });
  final String className, receptionPhone;
  final Teacher classTeacher;
  final List<Teacher> faculty;

  int countOf(TeacherCategory c) =>
      faculty.where((t) => t.category == c).length;

  Teacher? byId(String id) {
    for (final t in faculty) {
      if (t.id == id) return t;
    }
    return classTeacher.id == id ? classTeacher : null;
  }

  @override
  List<Object?> get props => [className, classTeacher, faculty, receptionPhone];
}
