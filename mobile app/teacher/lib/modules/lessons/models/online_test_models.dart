import 'package:equatable/equatable.dart';

int _int(dynamic v, [int d = 0]) => (v as num?)?.toInt() ?? d;

/// One question of an online test. [correct] is the index of the right option.
class TestQuestion extends Equatable {
  const TestQuestion({required this.id, this.section = 'A', this.type = 'MCQ', required this.prompt, this.marks = 1, this.options = const [], this.correct = 0});
  final String id, section, type, prompt;
  final int marks, correct;
  final List<String> options;

  factory TestQuestion.fromJson(Map<String, dynamic> j) => TestQuestion(
        id: '${j['id'] ?? ''}', section: '${j['section'] ?? 'A'}', type: '${j['type'] ?? 'MCQ'}', prompt: '${j['prompt'] ?? ''}', marks: _int(j['marks'], 1),
        options: [for (final o in (j['options'] as List? ?? const [])) '$o'], correct: _int(j['correct']),
      );
  Map<String, dynamic> toJson() => {'id': id, 'section': section, 'type': type, 'prompt': prompt, 'marks': marks, 'options': options, 'correct': correct};

  @override
  List<Object?> get props => [id, section, type, prompt, marks, options, correct];
}

/// Results summary of a completed test.
class TestResults extends Equatable {
  const TestResults({required this.submitted, required this.avg, required this.high, required this.low});
  final int submitted, avg, high, low;
  factory TestResults.fromJson(Map<String, dynamic> j) => TestResults(submitted: _int(j['submitted']), avg: _int(j['avg']), high: _int(j['high']), low: _int(j['low']));
  Map<String, dynamic> toJson() => {'submitted': submitted, 'avg': avg, 'high': high, 'low': low};
  @override
  List<Object?> get props => [submitted, avg, high, low];
}

/// An online test (collection `ts_tests`). [status]: `draft`, `upcoming`, `live`, `completed`. [cutoff] is a percentage.
class OnlineTest extends Equatable {
  const OnlineTest({
    required this.id, this.code = '', required this.title, required this.cls, required this.subject, this.type = 'Unit Test', this.status = 'draft',
    this.date = '', this.time = '09:30', this.duration = 45, this.students = 40, this.cutoff = 36, this.proctor = true, this.grace = true, this.notify = true,
    this.nq = 0, this.results, this.questions = const [],
  });

  final String id, code, title, cls, subject, type, status, date, time;
  final int duration, students, cutoff, nq;
  final bool proctor, grace, notify;
  final TestResults? results;
  final List<TestQuestion> questions;

  int get totalMarks => questions.fold(0, (a, q) => a + q.marks);
  bool get mcqOnly => questions.isNotEmpty && questions.every((q) => q.type == 'MCQ');

  factory OnlineTest.fromJson(Map<String, dynamic> j) => OnlineTest(
        id: '${j['id'] ?? ''}', code: '${j['code'] ?? ''}', title: '${j['title'] ?? ''}', cls: '${j['cls'] ?? ''}', subject: '${j['subject'] ?? ''}',
        type: '${j['type'] ?? 'Unit Test'}', status: '${j['status'] ?? 'draft'}', date: '${j['date'] ?? ''}', time: '${j['time'] ?? '09:30'}',
        duration: _int(j['duration'], 45), students: _int(j['students'], 40), cutoff: _int(j['cutoff'], 36), proctor: j['proctor'] == true,
        grace: j['grace'] == true, notify: j['notify'] == true, nq: _int(j['nq']),
        results: j['results'] is Map ? TestResults.fromJson(Map<String, dynamic>.from(j['results'] as Map)) : null,
        questions: [for (final q in (j['questions'] as List? ?? const [])) TestQuestion.fromJson(Map<String, dynamic>.from(q as Map))],
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'code': code, 'title': title, 'cls': cls, 'subject': subject, 'type': type, 'status': status, 'date': date, 'time': time,
        'duration': duration, 'students': students, 'cutoff': cutoff, 'proctor': proctor, 'grace': grace, 'notify': notify, 'nq': nq,
        'results': results?.toJson(), 'questions': [for (final q in questions) q.toJson()],
      };

  OnlineTest copyWith({
    String? id, String? code, String? title, String? cls, String? subject, String? type, String? status, String? date, String? time, int? duration,
    int? students, int? cutoff, bool? proctor, bool? grace, bool? notify, int? nq, TestResults? results, bool clearResults = false, List<TestQuestion>? questions,
  }) =>
      OnlineTest(
        id: id ?? this.id, code: code ?? this.code, title: title ?? this.title, cls: cls ?? this.cls, subject: subject ?? this.subject, type: type ?? this.type,
        status: status ?? this.status, date: date ?? this.date, time: time ?? this.time, duration: duration ?? this.duration, students: students ?? this.students,
        cutoff: cutoff ?? this.cutoff, proctor: proctor ?? this.proctor, grace: grace ?? this.grace, notify: notify ?? this.notify, nq: nq ?? this.nq,
        results: clearResults ? null : (results ?? this.results), questions: questions ?? this.questions,
      );

  @override
  List<Object?> get props => [id, code, title, cls, subject, type, status, date, time, duration, students, cutoff, proctor, grace, notify, nq, results, questions];
}
