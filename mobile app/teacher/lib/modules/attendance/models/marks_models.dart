import 'package:equatable/equatable.dart';

String gradeOf(double pct) => pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 35 ? 'D' : 'E';

class ExamSection extends Equatable {
  const ExamSection({required this.key, required this.name, required this.desc, required this.max});
  final String key, name, desc;
  final int max;
  String get field => key.toLowerCase();
  factory ExamSection.fromJson(Map<String, dynamic> j) =>
      ExamSection(key: j['k'] as String? ?? '', name: j['name'] as String? ?? '', desc: j['desc'] as String? ?? '', max: (j['max'] as num?)?.toInt() ?? 0);
  Map<String, dynamic> toJson() => {'k': key, 'name': name, 'desc': desc, 'max': max};
  @override
  List<Object?> get props => [key, name, desc, max];
}

/// An assessment of one class. status: Draft | Submitted.
class Exam extends Equatable {
  const Exam({required this.id, required this.classId, required this.name, required this.subject, required this.max, this.status = 'Draft', this.sections = const [], this.submittedAt});
  final String id, classId, name, subject, status;
  final int max;
  final List<ExamSection> sections;
  final String? submittedAt;
  /// Submitted by the teacher, or closed by the admin (both read-only in the list).
  bool get submitted => status == 'Submitted' || status == 'Locked';
  /// The admin's exam cell locked marks entry or published the results: no edits at all.
  bool get lockedByAdmin => status == 'Locked';
  factory Exam.fromJson(Map<String, dynamic> j) => Exam(
        id: j['id'] as String, classId: j['classId'] as String? ?? '', name: j['name'] as String? ?? '', subject: j['subject'] as String? ?? '',
        max: (j['max'] as num?)?.toInt() ?? 100, status: j['status'] as String? ?? 'Draft',
        sections: [for (final s in j['sections'] as List? ?? const []) ExamSection.fromJson(Map<String, dynamic>.from(s as Map))],
        submittedAt: j['submittedAt'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'classId': classId, 'name': name, 'subject': subject, 'max': max, 'status': status,
        'sections': [for (final s in sections) s.toJson()], 'submittedAt': ?submittedAt,
      };
  Exam copyWith({String? status, String? submittedAt}) =>
      Exam(id: id, classId: classId, name: name, subject: subject, max: max, status: status ?? this.status, sections: sections, submittedAt: submittedAt ?? this.submittedAt);
  @override
  List<Object?> get props => [id, classId, name, subject, max, status, sections, submittedAt];
}

class MarkEdit extends Equatable {
  const MarkEdit({required this.at, required this.by, required this.reason, this.from, this.to});
  final String at, by, reason;
  final int? from, to;
  factory MarkEdit.fromJson(Map<String, dynamic> j) => MarkEdit(
        at: j['at'] as String? ?? '', by: '${j['by'] ?? ''}', reason: j['reason'] as String? ?? '', from: (j['from'] as num?)?.toInt(), to: (j['to'] as num?)?.toInt(),
      );
  Map<String, dynamic> toJson() => {'at': at, 'by': by, 'reason': reason, 'from': from, 'to': to};
  @override
  List<Object?> get props => [at, by, reason, from, to];
}

/// One student's marks for one exam. id = '${examId}_$studentId'.
/// status: Present | Absent | Medical Slip | Disqualified. [sections] keyed by section field ('a','b','c').
class StudentMark extends Equatable {
  const StudentMark({required this.examId, required this.studentId, this.status = 'Present', this.marks, this.tag = '', this.note = '', this.sections = const {}, this.modifiedAt, this.modifiedBy, this.history = const []});
  final String examId, studentId, status, tag, note;
  final int? marks;
  final Map<String, int?> sections;
  final String? modifiedAt, modifiedBy;
  final List<MarkEdit> history;

  String get id => '${examId}_$studentId';
  bool get present => status == 'Present';
  bool get absent => !present;
  bool get graded => absent || marks != null;

  static String idOf(String examId, String studentId) => '${examId}_$studentId';

  String remark(double pct) => tag.isNotEmpty ? tag : pct >= 85 ? 'Excellent' : pct >= 70 ? 'Consistent' : pct >= 55 ? 'Needs Revision' : 'Needs Remedial Support';

  static const _known = {'id', 'examId', 'studentId', 'status', 'marks', 'tag', 'note', 'modifiedAt', 'modifiedBy', 'history'};

  factory StudentMark.fromJson(Map<String, dynamic> j) => StudentMark(
        examId: j['examId'] as String? ?? '', studentId: j['studentId'] as String? ?? '', status: j['status'] as String? ?? 'Present',
        marks: (j['marks'] as num?)?.toInt(), tag: j['tag'] as String? ?? '', note: j['note'] as String? ?? '',
        sections: {for (final e in j.entries) if (!_known.contains(e.key) && e.key.length == 1) e.key: (e.value as num?)?.toInt()},
        modifiedAt: j['modifiedAt'] as String?, modifiedBy: j['modifiedBy'] as String?,
        history: [for (final h in j['history'] as List? ?? const []) MarkEdit.fromJson(Map<String, dynamic>.from(h as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'examId': examId, 'studentId': studentId, 'status': status, 'marks': marks, 'tag': tag, 'note': note,
        ...sections, 'modifiedAt': ?modifiedAt, 'modifiedBy': ?modifiedBy, if (history.isNotEmpty) 'history': [for (final h in history) h.toJson()],
      };
  StudentMark copyWith({String? status, int? Function()? marks, String? tag, String? note, Map<String, int?>? sections, String? modifiedAt, String? modifiedBy, List<MarkEdit>? history}) =>
      StudentMark(
        examId: examId, studentId: studentId, status: status ?? this.status, marks: marks == null ? this.marks : marks(), tag: tag ?? this.tag,
        note: note ?? this.note, sections: sections ?? this.sections, modifiedAt: modifiedAt ?? this.modifiedAt, modifiedBy: modifiedBy ?? this.modifiedBy,
        history: history ?? this.history,
      );
  @override
  List<Object?> get props => [examId, studentId, status, marks, tag, note, sections, modifiedAt, modifiedBy, history];
}

typedef ExamStats = ({int total, int graded, int pending, int absent, double avg});

/// Per-exam progress numbers for a roster of [studentIds].
ExamStats examStats(Exam ex, List<String> studentIds, Map<String, StudentMark> marks) {
  var graded = 0, absent = 0, n = 0;
  double sum = 0;
  for (final id in studentIds) {
    final m = marks[id];
    if (m == null) continue;
    if (m.absent) {
      absent++;
      graded++;
      continue;
    }
    if (m.marks != null) {
      graded++;
      sum += m.marks! * 100 / ex.max;
      n++;
    }
  }
  return (total: studentIds.length, graded: graded, pending: studentIds.length - graded, absent: absent, avg: n == 0 ? 0 : sum / n);
}
