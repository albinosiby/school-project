import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import 'homework_models.dart';

/// One rubric criterion with its four level descriptions (exemplary, proficient, developing, beginning).
class Criterion {
  const Criterion(this.code, this.name, this.blurb, this.weight, this.levels);
  final String code, name, blurb;
  final double weight;
  final List<String> levels;
}

const kRubric = [
  Criterion('C1', 'Conceptual Understanding', 'Formula application & derivations', .3, [
    'Flawless formula derivation and root identity.', 'Sound method with minor computational slip.',
    'Formulas partially recalled with minor gaps.', 'Unable to set up quadratic standard form.',
  ]),
  Criterion('C2', 'Working & Discriminant Analysis', 'Factorization & root nature verification', .3, [
    'Clear factor analysis & nature of roots argued.', 'Systematic approach; minor square root slip.',
    'Omitted intermediate checks or descriptions.', 'Disorganized working or erroneous algebra.',
  ]),
  Criterion('C3', 'Word Problem Modeling', 'Projectile kinematics formulation', .2, [
    'Accurate real-world model & extraneous root check.', 'Valid model; missing context explanation.',
    'Misses key dimensional / physical constraints.', 'Incorrect setup; cannot parse constraints.',
  ]),
  Criterion('C4', 'Mathematical Precision', 'Symbols, algebraic units & boxed answers', .2, [
    'Flawless notation, symbols, and boxed roots.', 'Clear notation overall; minor unit omission.',
    'Minor notation skips or unsimplified radicals.', 'Lacks structure or required final statements.',
  ]),
];

const kLevelNames = ['Exemplary', 'Proficient', 'Developing', 'Beginning'];

/// Max marks of each criterion for a homework worth [max] marks (sums exactly to [max]).
List<int> criterionCaps(int max) {
  final caps = [for (var i = 0; i < kRubric.length - 1; i++) (max * kRubric[i].weight).round()];
  return caps..add(max - caps.fold<int>(0, (a, b) => a + b));
}

/// (low, high) mark range of each level for a criterion worth [cap].
List<(int, int)> levelRanges(int cap) {
  final e = (cap * .87).round(), p = (cap * .67).round(), d = (cap * .4).round();
  return [(e, cap), (p, e - 1), (d, p - 1), (0, d - 1)];
}

int levelIndex(int marks, int cap) {
  final r = levelRanges(cap);
  for (var i = 0; i < 3; i++) {
    if (marks >= r[i].$1) return i;
  }
  return 3;
}

int pctOf(num marks, int max) => max == 0 ? 0 : (marks * 100 / max).round();
String bandOf(int pct) => pct >= 90 ? 'Exemplary' : pct >= 65 ? 'Proficient' : pct >= 50 ? 'Developing' : 'Beginning';

/// Spreads [total] across criteria proportionally to the caps.
List<int> spreadMarks(int total, List<int> caps) {
  final max = caps.fold<int>(0, (a, b) => a + b);
  final out = <int>[];
  var left = total;
  for (var i = 0; i < caps.length; i++) {
    final v = i == caps.length - 1 ? left : (max == 0 ? 0 : (total * caps[i] / max).round());
    out.add(v.clamp(0, caps[i]));
    left -= out.last;
  }
  return out;
}

/// Per-criterion marks of a graded submission (stored `criteria`, or spread from the total).
List<int> criteriaOf(Submission sub, int max) {
  final c = sub.extra['criteria'];
  final caps = criterionCaps(max);
  if (c is List && c.length == caps.length) return [for (final v in c) (v as num?)?.toInt() ?? 0];
  return spreadMarks(sub.marks?.toInt() ?? 0, caps);
}

/// One student's line in the graded list.
class StudentRow extends Equatable {
  const StudentRow({required this.id, required this.name, required this.roll, required this.sub});
  final String id, name;
  final int roll;
  final Submission sub;
  SubmissionStatus get status => sub.status;
  int get marks => sub.marks?.toInt() ?? 0;
  @override
  List<Object?> get props => [id, name, roll, sub];
}

/// Grading statistics of one homework over the class roster.
class HomeworkStats {
  HomeworkStats(this.rows, this.max);
  final List<StudentRow> rows;
  final int max;

  factory HomeworkStats.of(Homework h, List<Student> students) {
    final roster = [for (final s in students) if (s.classId == h.classId) s];
    final ids = {for (final s in roster) s.id};
    final rows = [
      for (final s in roster) StudentRow(id: s.id, name: s.name, roll: s.roll, sub: h.submissions[s.id] ?? const Submission()),
      // submissions from students not in the roster still count
      for (final e in h.submissions.entries) if (!ids.contains(e.key)) StudentRow(id: e.key, name: e.key, roll: 0, sub: e.value),
    ]..sort((a, b) => a.roll.compareTo(b.roll));
    return HomeworkStats(rows, h.maxMarks.toInt());
  }

  int get total => rows.length;
  int get graded => rows.where((r) => r.status == SubmissionStatus.graded).length;
  int get toGrade => rows.where((r) => r.status == SubmissionStatus.submitted).length;
  int get turnedIn => graded + toGrade;
  int get notSubmitted => total - turnedIn;
  int get evaluatedPct => turnedIn == 0 ? 0 : (graded * 100 / turnedIn).round();
  bool isRemedial(StudentRow r) => r.status == SubmissionStatus.graded && pctOf(r.marks, max) < 50;
  int get remedial => rows.where(isRemedial).length;

  double get avg {
    final g = rows.where((r) => r.status == SubmissionStatus.graded).toList();
    return g.isEmpty ? 0 : g.fold<num>(0, (a, r) => a + r.marks) / g.length;
  }

  StudentRow? get next => rows.where((r) => r.status == SubmissionStatus.submitted).firstOrNull;

  /// Average marks of each criterion across graded papers.
  List<double> criterionAvgs() {
    final g = rows.where((r) => r.status == SubmissionStatus.graded).toList();
    final n = criterionCaps(max).length;
    if (g.isEmpty) return List.filled(n, 0);
    final sums = List<double>.filled(n, 0);
    for (final r in g) {
      final c = criteriaOf(r.sub, max);
      for (var i = 0; i < n; i++) {
        sums[i] += c[i];
      }
    }
    return [for (final v in sums) v / g.length];
  }
}
