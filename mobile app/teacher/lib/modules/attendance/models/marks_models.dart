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

/// The assessment scheme of a mark sheet (`exm_sheets.components`, copied from the paper): which components the
/// owner enters and their maxima. `mode` is `marks` (theory / practical / internal) or `grade` (one grade from
/// [gradeOptions]). A component with max 0 is not part of the sheet.
class ExamComponents extends Equatable {
  const ExamComponents({this.mode = 'marks', this.theory = 0, this.practical = 0, this.internal = 0, this.passMarks = 0, this.gradeOptions = const []});
  final String mode;
  final int theory, practical, internal, passMarks;
  final List<String> gradeOptions;

  bool get gradeOnly => mode == 'grade';
  int get maxTotal => theory + practical + internal;
  /// `(key, label, max)` of the numeric components the owner enters, in entry order (max 0 ones are hidden).
  List<({String key, String label, int max})> get numeric => [
        if (theory > 0) (key: 'theory', label: 'Theory', max: theory),
        if (practical > 0) (key: 'practical', label: 'Practical', max: practical),
        if (internal > 0) (key: 'internal', label: 'Internal', max: internal),
      ];
  int maxOf(String key) => switch (key) { 'theory' => theory, 'practical' => practical, 'internal' => internal, _ => 0 };

  factory ExamComponents.fromJson(Map<String, dynamic> j) => ExamComponents(
        mode: j['mode'] as String? ?? 'marks', theory: (j['theory'] as num?)?.toInt() ?? 0, practical: (j['practical'] as num?)?.toInt() ?? 0,
        internal: (j['internal'] as num?)?.toInt() ?? 0, passMarks: (j['passMarks'] as num?)?.toInt() ?? 0,
        gradeOptions: [for (final g in j['gradeOptions'] as List? ?? const []) '$g'],
      );
  Map<String, dynamic> toJson() => {'mode': mode, 'theory': theory, 'practical': practical, 'internal': internal, 'passMarks': passMarks, 'gradeOptions': gradeOptions};
  @override
  List<Object?> get props => [mode, theory, practical, internal, passMarks, gradeOptions];
}

/// An assessment of one class. status: Draft | Submitted | Returned | Locked.
///
/// With a mark sheet ([hasSheet], EXAMS_SHEETS_RESULTS_CONTRACT §4) the status is the sheet's: Draft (NotStarted /
/// InProgress), Submitted (read-only, under review), Returned (editable again, see [returnNote]) and Locked
/// (Approved / Locked). Legacy papers without a sheet keep the teacher's own Draft / Submitted state.
class Exam extends Equatable {
  const Exam({
    required this.id, required this.classId, required this.name, required this.subject, required this.max, this.status = 'Draft', this.sections = const [],
    this.submittedAt, this.studentIds, this.components, this.returnNote, this.rosterIds, this.hasSheet = false,
  });
  final String id, classId, name, subject, status;
  /// Max of the inline (theory) field. For a sheet this is the theory component's max (0 = no theory field).
  final int max;
  final List<ExamSection> sections;
  final List<String>? studentIds;
  final String? submittedAt;
  /// Sheet scheme; null for legacy papers.
  final ExamComponents? components;
  /// The reviewer's note when the sheet was returned for correction.
  final String? returnNote;
  /// Students the sheet covers (`exm_sheets.rosterIds`); null for legacy papers.
  final List<String>? rosterIds;
  final bool hasSheet;

  /// Submitted by the teacher, or closed by the admin (both read-only in the list).
  bool get submitted => status == 'Submitted' || status == 'Locked';
  /// The admin's exam cell locked marks entry or published the results: no edits at all.
  bool get lockedByAdmin => status == 'Locked';
  /// Sent back by the reviewer: editable again, with [returnNote] shown.
  bool get returned => status == 'Returned';
  /// No edits at all: locked by the admin, or a sheet that is under review (Submitted). A legacy Submitted exam still
  /// takes edits with a reason.
  bool get readOnly => lockedByAdmin || (hasSheet && status == 'Submitted');
  bool get gradeOnly => components?.gradeOnly == true;
  /// Highest total a student can score (all components) — what percentages are computed against.
  int get maxTotal => hasSheet && components != null && !gradeOnly ? components!.maxTotal : max;
  int get passMarks => components?.passMarks ?? 0;

  factory Exam.fromJson(Map<String, dynamic> j) => Exam(
        id: j['id'] as String, classId: j['classId'] as String? ?? '', name: j['name'] as String? ?? '', subject: j['subject'] as String? ?? '',
        max: (j['max'] as num?)?.toInt() ?? 100, status: j['status'] as String? ?? 'Draft',
        sections: [for (final s in j['sections'] as List? ?? const []) ExamSection.fromJson(Map<String, dynamic>.from(s as Map))],
        submittedAt: j['submittedAt'] as String?,
        studentIds: (j['studentIds'] as List?)?.map((id) => '$id').toList(),
        components: j['components'] is Map ? ExamComponents.fromJson(Map<String, dynamic>.from(j['components'] as Map)) : null,
        returnNote: j['returnNote'] as String?,
        rosterIds: (j['rosterIds'] as List?)?.map((id) => '$id').toList(),
        hasSheet: j['hasSheet'] == true,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'classId': classId, 'name': name, 'subject': subject, 'max': max, 'status': status,
        'sections': [for (final s in sections) s.toJson()], 'submittedAt': ?submittedAt, 'studentIds': ?studentIds,
        'components': ?components?.toJson(), 'returnNote': ?returnNote, 'rosterIds': ?rosterIds, if (hasSheet) 'hasSheet': true,
      };
  Exam copyWith({String? status, String? submittedAt}) => Exam(
        id: id, classId: classId, name: name, subject: subject, max: max, status: status ?? this.status, sections: sections,
        submittedAt: submittedAt ?? this.submittedAt, studentIds: studentIds, components: components, returnNote: returnNote, rosterIds: rosterIds, hasSheet: hasSheet,
      );
  @override
  List<Object?> get props => [id, classId, name, subject, max, status, sections, submittedAt, studentIds, components, returnNote, rosterIds, hasSheet];
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
/// [marks] is the theory component; a mark sheet adds [practical], [internal] and, for grade-only sheets, [gradeValue].
class StudentMark extends Equatable {
  const StudentMark({
    required this.examId, required this.studentId, this.status = 'Present', this.marks, this.practical, this.internal, this.gradeValue = '', this.tag = '', this.note = '',
    this.sections = const {}, this.modifiedAt, this.modifiedBy, this.history = const [],
  });
  final String examId, studentId, status, tag, note, gradeValue;
  final int? marks, practical, internal;
  final Map<String, int?> sections;
  final String? modifiedAt, modifiedBy;
  final List<MarkEdit> history;

  String get id => '${examId}_$studentId';
  bool get present => status == 'Present';
  bool get absent => !present;
  /// Something was recorded: an attendance status other than Present, a grade, or at least one numeric component.
  bool get entered => absent || marks != null || practical != null || internal != null || gradeValue.isNotEmpty;
  bool get graded => entered;
  /// Sum of the numeric components entered (null when none).
  int? get total => marks == null && practical == null && internal == null ? null : (marks ?? 0) + (practical ?? 0) + (internal ?? 0);
  int? componentOf(String key) => switch (key) { 'theory' => marks, 'practical' => practical, 'internal' => internal, _ => null };

  static String idOf(String examId, String studentId) => '${examId}_$studentId';

  String remark(double pct) => tag.isNotEmpty ? tag : pct >= 85 ? 'Excellent' : pct >= 70 ? 'Consistent' : pct >= 55 ? 'Needs Revision' : 'Needs Remedial Support';

  static const _known = {'id', 'examId', 'studentId', 'status', 'marks', 'practical', 'internal', 'gradeValue', 'tag', 'note', 'modifiedAt', 'modifiedBy', 'history'};

  factory StudentMark.fromJson(Map<String, dynamic> j) => StudentMark(
        examId: j['examId'] as String? ?? '', studentId: j['studentId'] as String? ?? '', status: j['status'] as String? ?? 'Present',
        marks: (j['marks'] as num?)?.toInt(), practical: (j['practical'] as num?)?.toInt(), internal: (j['internal'] as num?)?.toInt(),
        gradeValue: '${j['gradeValue'] ?? ''}', tag: j['tag'] as String? ?? '', note: j['note'] as String? ?? '',
        sections: {for (final e in j.entries) if (!_known.contains(e.key) && e.key.length == 1) e.key: (e.value as num?)?.toInt()},
        modifiedAt: j['modifiedAt'] as String?, modifiedBy: j['modifiedBy'] as String?,
        history: [for (final h in j['history'] as List? ?? const []) MarkEdit.fromJson(Map<String, dynamic>.from(h as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'examId': examId, 'studentId': studentId, 'status': status, 'marks': marks, 'practical': practical, 'internal': internal, 'gradeValue': gradeValue,
        'tag': tag, 'note': note, ...sections, 'modifiedAt': ?modifiedAt, 'modifiedBy': ?modifiedBy, if (history.isNotEmpty) 'history': [for (final h in history) h.toJson()],
      };
  StudentMark copyWith({
    String? status, int? Function()? marks, int? Function()? practical, int? Function()? internal, String? gradeValue, String? tag, String? note,
    Map<String, int?>? sections, String? modifiedAt, String? modifiedBy, List<MarkEdit>? history,
  }) =>
      StudentMark(
        examId: examId, studentId: studentId, status: status ?? this.status, marks: marks == null ? this.marks : marks(),
        practical: practical == null ? this.practical : practical(), internal: internal == null ? this.internal : internal(), gradeValue: gradeValue ?? this.gradeValue,
        tag: tag ?? this.tag, note: note ?? this.note, sections: sections ?? this.sections, modifiedAt: modifiedAt ?? this.modifiedAt, modifiedBy: modifiedBy ?? this.modifiedBy,
        history: history ?? this.history,
      );
  @override
  List<Object?> get props => [examId, studentId, status, marks, practical, internal, gradeValue, tag, note, sections, modifiedAt, modifiedBy, history];
}

typedef ExamStats = ({int total, int graded, int pending, int absent, double avg});

/// Per-exam progress numbers for a roster of [studentIds]. The average is over the students' totals against
/// [Exam.maxTotal] (grade-only sheets have no average).
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
    if (m.entered) {
      graded++;
      if (m.total != null && ex.maxTotal > 0) {
        sum += m.total! * 100 / ex.maxTotal;
        n++;
      }
    }
  }
  return (total: studentIds.length, graded: graded, pending: studentIds.length - graded, absent: absent, avg: n == 0 ? 0 : sum / n);
}

/// Why a sheet cannot be submitted yet: every rostered student needs a mark (every component of the scheme, in range)
/// or an attendance status other than Present. Returns null when the sheet is complete.
String? sheetSubmitProblem(Exam ex, Map<String, StudentMark> marks) {
  final roster = ex.rosterIds ?? ex.studentIds ?? const <String>[];
  var missing = 0, outOfRange = 0;
  for (final id in roster) {
    final m = marks[id];
    if (m == null || !m.entered) {
      missing++;
      continue;
    }
    if (m.absent) continue;
    final c = ex.components;
    if (c == null) continue;
    if (c.gradeOnly) {
      if (m.gradeValue.isEmpty || (c.gradeOptions.isNotEmpty && !c.gradeOptions.contains(m.gradeValue))) missing++;
      continue;
    }
    var blank = false, over = false;
    for (final comp in c.numeric) {
      final v = m.componentOf(comp.key);
      if (v == null) blank = true;
      if (v != null && (v < 0 || v > comp.max)) over = true;
    }
    if (over) {
      outOfRange++;
    } else if (blank) {
      missing++;
    }
  }
  if (missing == 0 && outOfRange == 0) return null;
  return [
    if (missing > 0) '$missing of ${roster.length} students still pending: enter every component or mark them Absent.',
    if (outOfRange > 0) '$outOfRange ${outOfRange == 1 ? 'mark is' : 'marks are'} out of range.',
  ].join(' ');
}
