import 'package:equatable/equatable.dart';

List<Map<String, dynamic>> _maps(dynamic v) => [for (final e in (v as List? ?? const [])) Map<String, dynamic>.from(e as Map)];
List<String> _strs(dynamic v) => [for (final e in (v as List? ?? const [])) '$e'];
int _int(dynamic v, [int d = 0]) => (v as num?)?.toInt() ?? d;

/// One teaching milestone of a lesson plan (a day of the sequence).
class Milestone extends Equatable {
  const Milestone({required this.title, this.done = false, this.today = false});
  final String title;
  final bool done, today;

  factory Milestone.fromJson(Map<String, dynamic> j) => Milestone(title: '${j['title'] ?? ''}', done: j['done'] == true, today: j['today'] == true);
  Map<String, dynamic> toJson() => {'title': title, 'done': done, 'today': today};
  Milestone copyWith({bool? done, bool? today}) => Milestone(title: title, done: done ?? this.done, today: today ?? this.today);

  @override
  List<Object?> get props => [title, done, today];
}

class LessonObjective extends Equatable {
  const LessonObjective({required this.title, this.desc = ''});
  final String title, desc;
  factory LessonObjective.fromJson(Map<String, dynamic> j) => LessonObjective(title: '${j['title'] ?? ''}', desc: '${j['desc'] ?? ''}');
  Map<String, dynamic> toJson() => {'title': title, 'desc': desc};
  @override
  List<Object?> get props => [title, desc];
}

class LessonActivity extends Equatable {
  const LessonActivity({required this.title, this.mins = 5, this.desc = ''});
  final String title, desc;
  final int mins;
  factory LessonActivity.fromJson(Map<String, dynamic> j) => LessonActivity(title: '${j['title'] ?? ''}', mins: _int(j['mins'], 5), desc: '${j['desc'] ?? ''}');
  Map<String, dynamic> toJson() => {'title': title, 'mins': mins, 'desc': desc};
  @override
  List<Object?> get props => [title, mins, desc];
}

class LessonResource extends Equatable {
  const LessonResource({required this.name, this.meta = ''});
  final String name, meta;
  factory LessonResource.fromJson(Map<String, dynamic> j) => LessonResource(name: '${j['name'] ?? ''}', meta: '${j['meta'] ?? ''}');
  Map<String, dynamic> toJson() => {'name': name, 'meta': meta};
  @override
  List<Object?> get props => [name, meta];
}

/// A lesson plan (collection `ls_plans`). [stage] is `ongoing`, `upcoming` or `completed`.
class LessonPlan extends Equatable {
  const LessonPlan({
    required this.id, this.code = '', required this.cls, required this.subject, this.term = 'Term 2', required this.title, this.summary = '',
    this.stage = 'upcoming', this.draft = false, this.day = 1, this.days = 5, this.periods = 1, this.ncert = '', this.date = '',
    this.milestones = const [], this.sched = '', this.bloom = 'Apply', this.outcome = '', this.saved = '', this.concepts = const [],
    this.objectives = const [], this.activities = const [], this.resources = const [], this.approval = '', this.period = '',
  });

  final String id, code, cls, subject, term, title, summary, stage, ncert, date, sched, bloom, outcome, saved, approval, period;
  final bool draft;
  final int day, days, periods;
  final List<Milestone> milestones;
  final List<String> concepts;
  final List<LessonObjective> objectives;
  final List<LessonActivity> activities;
  final List<LessonResource> resources;

  /// Active = published and not completed.
  bool get isActive => !draft && stage != 'completed';
  int get doneMilestones => milestones.where((m) => m.done).length;
  double get progress => milestones.isEmpty ? 0 : doneMilestones / milestones.length;
  int get totalMins => activities.fold(0, (a, e) => a + e.mins);

  factory LessonPlan.fromJson(Map<String, dynamic> j) => LessonPlan(
        id: '${j['id'] ?? ''}', code: '${j['code'] ?? ''}', cls: '${j['cls'] ?? ''}', subject: '${j['subject'] ?? ''}', term: '${j['term'] ?? 'Term 2'}',
        title: '${j['title'] ?? ''}', summary: '${j['summary'] ?? ''}', stage: '${j['stage'] ?? 'upcoming'}', draft: j['draft'] == true,
        day: _int(j['day'], 1), days: _int(j['days'], 5), periods: _int(j['periods'], 1), ncert: '${j['ncert'] ?? ''}', date: '${j['date'] ?? ''}',
        milestones: [for (final m in _maps(j['milestones'])) Milestone.fromJson(m)], sched: '${j['sched'] ?? ''}', bloom: '${j['bloom'] ?? 'Apply'}',
        outcome: '${j['outcome'] ?? ''}', saved: '${j['saved'] ?? ''}', concepts: _strs(j['concepts']),
        objectives: [for (final m in _maps(j['objectives'])) LessonObjective.fromJson(m)],
        activities: [for (final m in _maps(j['activities'])) LessonActivity.fromJson(m)],
        resources: [for (final m in _maps(j['resources'])) LessonResource.fromJson(m)],
        approval: '${j['approval'] ?? ''}', period: '${j['period'] ?? ''}',
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'code': code, 'cls': cls, 'subject': subject, 'term': term, 'title': title, 'summary': summary, 'stage': stage, 'draft': draft,
        'day': day, 'days': days, 'periods': periods, 'ncert': ncert, 'date': date, 'milestones': [for (final m in milestones) m.toJson()],
        'sched': sched, 'bloom': bloom, 'outcome': outcome, 'saved': saved, 'concepts': concepts,
        'objectives': [for (final o in objectives) o.toJson()], 'activities': [for (final a in activities) a.toJson()],
        'resources': [for (final r in resources) r.toJson()], 'approval': approval, 'period': period,
      };

  LessonPlan copyWith({
    String? id, String? code, String? cls, String? subject, String? title, String? summary, String? stage, bool? draft, int? day, int? days, int? periods,
    String? ncert, String? date, List<Milestone>? milestones, String? sched, String? bloom, String? outcome, String? saved, List<String>? concepts,
    List<LessonObjective>? objectives, List<LessonActivity>? activities, List<LessonResource>? resources, String? approval, String? period,
  }) =>
      LessonPlan(
        id: id ?? this.id, code: code ?? this.code, cls: cls ?? this.cls, subject: subject ?? this.subject, term: term, title: title ?? this.title,
        summary: summary ?? this.summary, stage: stage ?? this.stage, draft: draft ?? this.draft, day: day ?? this.day, days: days ?? this.days,
        periods: periods ?? this.periods, ncert: ncert ?? this.ncert, date: date ?? this.date, milestones: milestones ?? this.milestones,
        sched: sched ?? this.sched, bloom: bloom ?? this.bloom, outcome: outcome ?? this.outcome, saved: saved ?? this.saved,
        concepts: concepts ?? this.concepts, objectives: objectives ?? this.objectives, activities: activities ?? this.activities,
        resources: resources ?? this.resources, approval: approval ?? this.approval, period: period ?? this.period,
      );

  @override
  List<Object?> get props => [id, code, cls, subject, term, title, summary, stage, draft, day, days, periods, ncert, date, milestones, sched, bloom, outcome, saved, concepts, objectives, activities, resources, approval, period];
}
