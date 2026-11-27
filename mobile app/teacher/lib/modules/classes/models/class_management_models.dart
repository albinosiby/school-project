import 'package:equatable/equatable.dart';

/// One period of the class timetable (any subject / teacher): weekday 1-7, period number.
class ClassPeriod extends Equatable {
  const ClassPeriod({required this.classId, required this.day, required this.period, required this.subject, this.teacher = ''});
  final String classId, subject, teacher;
  final int day, period;
  factory ClassPeriod.fromJson(Map<String, dynamic> j) => ClassPeriod(
    classId: '${j['classId'] ?? ''}',
    day: (j['day'] as num?)?.toInt() ?? 0,
    period: (j['period'] as num?)?.toInt() ?? 0,
    subject: '${j['subject'] ?? ''}',
    teacher: '${j['teacher'] ?? ''}',
  );
  @override
  List<Object?> get props => [classId, day, period, subject, teacher];
}

/// One mark of a student in one subject of one exam (any teacher's).
class ClassMark extends Equatable {
  const ClassMark({
    required this.studentId,
    required this.subject,
    required this.exam,
    this.cycleId = '',
    this.paperId = '',
    this.date = '',
    this.score,
    this.max = 0,
    this.grade = '',
    this.status = 'Present',
  });
  final String studentId, subject, exam, cycleId, paperId, date, grade, status;
  final int? score;
  final int max;

  bool get absent => status != 'Present';

  /// Percentage, or null for grade-only papers, absences and missing scores.
  double? get pct => score == null || max <= 0 ? null : score! * 100 / max;

  factory ClassMark.fromJson(Map<String, dynamic> j) => ClassMark(
    studentId: '${j['studentId'] ?? ''}',
    subject: '${j['subject'] ?? ''}',
    exam: '${j['exam'] ?? ''}',
    cycleId: '${j['cycleId'] ?? ''}',
    paperId: '${j['paperId'] ?? ''}',
    date: '${j['date'] ?? ''}',
    score: (j['score'] as num?)?.toInt(),
    max: (j['max'] as num?)?.toInt() ?? 0,
    grade: '${j['grade'] ?? ''}',
    status: '${j['status'] ?? 'Present'}',
  );
  @override
  List<Object?> get props => [studentId, subject, exam, cycleId, paperId, date, score, max, grade, status];
}
