import 'package:equatable/equatable.dart';

String gradeFor(double percent) {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B+';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 40) return 'D';
  return 'E';
}

class SubjectMark extends Equatable {
  const SubjectMark({
    required this.subject,
    required this.obtained,
    required this.max,
  });
  final String subject;
  final double obtained, max;

  double get percent => max == 0 ? 0 : obtained / max * 100;
  String get grade => gradeFor(percent);

  @override
  List<Object?> get props => [subject, obtained, max];
}

class ExamResult extends Equatable {
  const ExamResult({
    required this.id,
    required this.name,
    required this.date,
    this.subjects = const [],
    this.remarks,
    this.rank,
    this.classSize,
  });
  final String id, name;
  final DateTime date;
  final List<SubjectMark> subjects;
  final String? remarks;
  final int? rank, classSize;

  /// Results not published yet (an upcoming or just-written exam).
  bool get published => subjects.isNotEmpty;
  double get obtained => subjects.fold(0, (a, s) => a + s.obtained);
  double get max => subjects.fold(0, (a, s) => a + s.max);
  double get percent => max == 0 ? 0 : obtained / max * 100;
  String get grade => gradeFor(percent);

  @override
  List<Object?> get props => [
    id,
    name,
    date,
    subjects,
    remarks,
    rank,
    classSize,
  ];
}
