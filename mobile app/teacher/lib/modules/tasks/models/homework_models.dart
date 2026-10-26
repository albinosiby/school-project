import 'package:equatable/equatable.dart';

enum SubmissionStatus { pending, submitted, graded }

/// One student's submission for a homework. Extra keys (criteria, rationale, …) are kept in [extra].
class Submission extends Equatable {
  const Submission({this.status = SubmissionStatus.pending, this.marks, this.feedback = '', this.gradedAt, this.extra = const {}});
  final SubmissionStatus status;
  final num? marks;
  final String feedback;
  final String? gradedAt;
  final Map<String, dynamic> extra;

  factory Submission.fromJson(Map<String, dynamic> j) => Submission(
        status: SubmissionStatus.values.asNameMap()[j['status']] ?? SubmissionStatus.pending,
        marks: j['marks'] as num?, feedback: j['feedback'] as String? ?? '', gradedAt: j['gradedAt'] as String?,
        extra: {for (final e in j.entries) if (!const {'status', 'marks', 'feedback', 'gradedAt'}.contains(e.key)) e.key: e.value},
      );
  Map<String, dynamic> toJson() => {...extra, 'status': status.name, 'marks': ?marks, 'feedback': feedback, 'gradedAt': ?gradedAt};

  @override
  List<Object?> get props => [status, marks, feedback, gradedAt, extra];
}

/// Homework shared by the classes module (creates it at /homework/new) and the tasks module (grading).
class Homework extends Equatable {
  const Homework({required this.id, required this.classId, required this.title, required this.subject, required this.due, required this.maxMarks, this.description = '', this.status = 'open', required this.createdAt, this.submissions = const {}, this.extra = const {}});
  final String id, classId, title, subject, due, description, status, createdAt;
  final num maxMarks;
  /// studentId -> submission
  final Map<String, Submission> submissions;
  /// Additional fields (code, topic, formats, allowLate, notify, attachment, …).
  final Map<String, dynamic> extra;

  static const _known = {'id', 'classId', 'title', 'subject', 'due', 'maxMarks', 'description', 'status', 'createdAt', 'submissions'};

  int count(SubmissionStatus s) => submissions.values.where((x) => x.status == s).length;
  int get turnedIn => submissions.length - count(SubmissionStatus.pending);

  factory Homework.fromJson(Map<String, dynamic> j) => Homework(
        id: j['id'] as String, classId: j['classId'] as String? ?? '', title: j['title'] as String? ?? '', subject: j['subject'] as String? ?? '',
        due: j['due'] as String? ?? '', maxMarks: j['maxMarks'] as num? ?? 0, description: j['description'] as String? ?? '',
        status: j['status'] as String? ?? 'open', createdAt: j['createdAt'] as String? ?? '',
        submissions: {for (final e in (j['submissions'] as Map? ?? const {}).entries) '${e.key}': Submission.fromJson(Map<String, dynamic>.from(e.value as Map))},
        extra: {for (final e in j.entries) if (!_known.contains(e.key)) e.key: e.value},
      );
  Map<String, dynamic> toJson() => {
        ...extra, 'id': id, 'classId': classId, 'title': title, 'subject': subject, 'due': due, 'maxMarks': maxMarks, 'description': description,
        'status': status, 'createdAt': createdAt, 'submissions': {for (final e in submissions.entries) e.key: e.value.toJson()},
      };

  Homework copyWith({String? status, String? title, String? due, num? maxMarks, String? description, Map<String, Submission>? submissions, Map<String, dynamic>? extra}) => Homework(
        id: id, classId: classId, title: title ?? this.title, subject: subject, due: due ?? this.due, maxMarks: maxMarks ?? this.maxMarks,
        description: description ?? this.description, status: status ?? this.status, createdAt: createdAt,
        submissions: submissions ?? this.submissions, extra: extra ?? this.extra,
      );

  @override
  List<Object?> get props => [id, classId, title, subject, due, maxMarks, description, status, createdAt, submissions, extra];
}
