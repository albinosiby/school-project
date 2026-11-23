import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';

class Guardian extends Equatable {
  const Guardian({required this.id, required this.name, required this.email, required this.phone, this.relation = 'Father'});
  final String id, name, email, phone, relation;

  @override
  List<Object?> get props => [id, name, email, phone, relation];
}

class Child extends Equatable {
  const Child({
    required this.id,
    required this.name,
    required this.grade,
    required this.section,
    required this.rollNo,
    required this.admissionNo,
    required this.classTeacher,
    this.classId = '',
  });
  final String id, name, grade, section, admissionNo, classTeacher, classId;
  final int rollNo;

  String get className => schoolClassLabel(grade: grade, section: section, classId: classId);
  String get firstName => name.split(' ').first;

  @override
  List<Object?> get props => [id, name, grade, section, rollNo, admissionNo, classTeacher, classId];
}

class Family extends Equatable {
  const Family({required this.guardian, required this.children});
  final Guardian guardian;
  final List<Child> children;

  @override
  List<Object?> get props => [guardian, children];
}
