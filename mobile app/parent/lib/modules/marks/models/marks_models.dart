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
    this.recordedGrade,
    this.assessmentMode = 'marks',
    this.status = 'Present',
    this.weight = 1,
    this.incomplete = false,
  });
  final String subject;
  final double obtained, max;
  final String? recordedGrade;
  final String assessmentMode, status;
  final double weight;
  final bool incomplete;
  bool get excluded => assessmentMode == 'grade' || status == 'Exempt';

  double get percent => max == 0 ? 0 : obtained / max * 100;
  String get grade => recordedGrade ?? gradeFor(percent);

  @override
  List<Object?> get props => [subject, obtained, max, recordedGrade, assessmentMode, status, weight, incomplete];
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
    this.calculation = 'total',
    this.rounding = 'none',
    this.absentRule = 'incomplete',
    this.gradingScale = '',
    this.reportBatchId,
    this.expectedSubjects = 0,
  });
  final String id, name;
  final DateTime date;
  final List<SubjectMark> subjects;
  final String? remarks;
  final int? rank, classSize;
  final String calculation, rounding, absentRule, gradingScale;
  final String? reportBatchId;
  final int expectedSubjects;
  Iterable<SubjectMark> get numericSubjects => subjects.where((s) => !s.excluded);
  bool get complete => subjects.length >= expectedSubjects && subjects.every((s) => !s.incomplete || s.status == 'Exempt' || (s.status == 'Absent' && absentRule == 'zero'));

  /// Results not published yet (an upcoming or just-written exam).
  bool get published => subjects.isNotEmpty;
  double get obtained => numericSubjects.fold(0, (a, s) => a + s.obtained);
  double get max => numericSubjects.fold(0, (a, s) => a + s.max);
  double get percent {
    if (max == 0) return 0;
    var value = obtained / max * 100;
    if (calculation == 'average' || calculation == 'weighted') {
      final divisor = numericSubjects.fold<double>(0, (a, s) => a + (calculation == 'weighted' ? s.weight : 1));
      value = divisor == 0 ? 0 : numericSubjects.fold<double>(0, (a, s) => a + s.percent * (calculation == 'weighted' ? s.weight : 1)) / divisor;
    }
    final places = {'whole': 0, 'one-decimal': 1, 'two-decimal': 2}[rounding];
    return places == null ? value : double.parse(value.toStringAsFixed(places));
  }
  String get grade {
    if (!complete || numericSubjects.isEmpty) return '--';
    final p = percent;
    if (gradingScale == 'Percentage only') return '$p%';
    if (gradingScale == 'GPA (4 point)') return p >= 90 ? '4.0' : p >= 80 ? '3.0' : p >= 70 ? '2.0' : p >= 60 ? '1.0' : '0.0';
    if (gradingScale == '5-Point Letter Scale') return p >= 80 ? 'A' : p >= 60 ? 'B' : p >= 40 ? 'C' : p >= 33 ? 'D' : 'E';
    if (gradingScale.startsWith('CBSE')) return p >= 91 ? 'A1' : p >= 81 ? 'A2' : p >= 71 ? 'B1' : p >= 61 ? 'B2' : p >= 51 ? 'C1' : p >= 41 ? 'C2' : p >= 33 ? 'D' : 'E';
    return gradeFor(p);
  }

  @override
  List<Object?> get props => [
    id,
    name,
    date,
    subjects,
    remarks,
    rank,
    classSize, calculation, rounding, absentRule, gradingScale, reportBatchId, expectedSubjects,
  ];
}
