import '../../engage/models/attachment_models.dart';
import '../../school/models/school_models.dart';
import 'homework_models.dart';

/// What a guardian handed in through the parent app (server copy in `ops_homework.handins`).
class Handin {
  const Handin({this.files = const [], this.note = '', this.submittedAt = '', this.late = false});
  final List<FileRef> files;
  final String note, submittedAt;
  final bool late;
  factory Handin.fromJson(Map<String, dynamic> j) => Handin(
    files: [
      for (final f in j['files'] as List? ?? const [])
        if (f is Map)
          FileRef(
            name: '${f['name'] ?? 'File'}',
            url: '${f['url'] ?? ''}',
            path: '${f['path'] ?? ''}',
            contentType: '${f['type'] ?? ''}',
            bytes: (f['size'] as num?)?.toInt() ?? 0,
            kind: '${f['type'] ?? ''}'.startsWith('image/') ? 'image' : 'file',
          ),
    ],
    note: '${j['note'] ?? ''}',
    submittedAt: '${j['submittedAt'] ?? ''}',
    late: j['late'] == true,
  );
}

extension SubmissionHandin on Submission {
  /// The parent app hand-in, if any.
  Handin? get handin => extra['handin'] is Map ? Handin.fromJson(Map<String, dynamic>.from(extra['handin'] as Map)) : null;

  /// Handed in on paper (marked by the teacher, nothing uploaded).
  bool get onPaper => status != SubmissionStatus.pending && handin == null;
  bool get late => handin?.late == true || extra['late'] == true;
}

extension HomeworkSettings on Homework {
  /// Marked out of [maxMarks]; 0 marks = not graded (done / not done).
  bool get graded => maxMarks > 0;
  bool get open => status == 'open';

  /// Waiting for its publish time ([publishAt]); parents see it only then.
  bool get scheduled => status == 'scheduled';
  DateTime? get publishAt => DateTime.tryParse('${extra['publishAt'] ?? ''}')?.toLocal();
  bool get allowLate => extra['allowLate'] != false;
  List<FileRef> get attachments => [for (final a in extra['attachments'] as List? ?? const []) ?FileRef.maybe(a)];

  /// Days until the due day (negative = overdue), null without a valid due date.
  int? daysLeft(DateTime today) {
    final d = DateTime.tryParse(due.length >= 10 ? due.substring(0, 10) : due);
    if (d == null) return null;
    return DateTime(d.year, d.month, d.day).difference(DateTime(today.year, today.month, today.day)).inDays;
  }
}

int pctOf(num marks, int max) => max == 0 ? 0 : (marks * 100 / max).round();

/// One student on a homework: roster data and their submission.
class StudentRow {
  const StudentRow({required this.id, required this.name, required this.roll, required this.sub, this.photo = ''});
  final String id, name, photo;
  final int roll;
  final Submission sub;
  SubmissionStatus get status => sub.status;
  num get marks => sub.marks ?? 0;
}

/// Hand-in and grading figures of one homework over its class roster.
class HomeworkStats {
  HomeworkStats(this.rows, this.max);
  final List<StudentRow> rows;
  final int max;

  factory HomeworkStats.of(Homework h, List<Student> students) {
    final roster = [for (final s in students) if (s.classId == h.classId) s];
    final ids = {for (final s in roster) s.id};
    final rows = [
      for (final s in roster) StudentRow(id: s.id, name: s.name, roll: s.roll, photo: s.photo, sub: h.submissions[s.id] ?? const Submission()),
      for (final e in h.submissions.entries)
        if (!ids.contains(e.key)) StudentRow(id: e.key, name: e.key, roll: 0, sub: e.value),
    ]..sort((a, b) => (a.roll <= 0 ? 9999 : a.roll).compareTo(b.roll <= 0 ? 9999 : b.roll));
    return HomeworkStats(rows, h.maxMarks.toInt());
  }

  int get total => rows.length;
  int get graded => rows.where((r) => r.status == SubmissionStatus.graded).length;
  int get toGrade => rows.where((r) => r.status == SubmissionStatus.submitted).length;
  int get turnedIn => graded + toGrade;
  int get notSubmitted => total - turnedIn;
  int get late => rows.where((r) => r.status != SubmissionStatus.pending && r.sub.late).length;
  int get uploaded => rows.where((r) => r.sub.handin != null).length;
  int get evaluatedPct => turnedIn == 0 ? 0 : (graded * 100 / turnedIn).round();

  List<StudentRow> get gradedRows => [for (final r in rows) if (r.status == SubmissionStatus.graded && r.sub.marks != null) r];

  /// Average of the graded marks (null when none).
  double? get avg {
    final g = gradedRows;
    return g.isEmpty ? null : g.fold<num>(0, (a, r) => a + r.marks) / g.length;
  }

  /// Graded students by % band: <40, 40-60, 60-75, 75-90, 90+.
  List<int> get bands {
    final b = List.filled(5, 0);
    for (final r in gradedRows) {
      final p = pctOf(r.marks, max);
      b[p < 40 ? 0 : p < 60 ? 1 : p < 75 ? 2 : p < 90 ? 3 : 4]++;
    }
    return b;
  }

  /// Next handed-in paper still to grade after [afterId] (wraps), null when none.
  StudentRow? nextToGrade([String? afterId]) {
    final todo = [for (final r in rows) if (r.status == SubmissionStatus.submitted) r];
    if (todo.isEmpty) return null;
    final i = todo.indexWhere((r) => r.id == afterId);
    return i < 0 ? todo.first : (todo.length == 1 ? null : todo[(i + 1) % todo.length]);
  }
}
