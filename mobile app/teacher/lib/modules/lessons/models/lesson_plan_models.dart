import 'package:equatable/equatable.dart';
import '../../engage/models/attachment_models.dart';

List<Map<String, dynamic>> _maps(dynamic v) => [
  for (final e in (v as List? ?? const []))
    if (e is Map) Map<String, dynamic>.from(e),
];
List<String> _strs(dynamic v) => [
  for (final e in (v as List? ?? const []))
    if ('$e'.trim().isNotEmpty) '$e',
];
int _int(dynamic v, [int d = 0]) => (v as num?)?.toInt() ?? d;

/// One step of a session ("Warm-up · 10 min").
class SessionActivity extends Equatable {
  const SessionActivity({required this.title, this.mins = 10});
  final String title;
  final int mins;
  factory SessionActivity.fromJson(Map<String, dynamic> j) =>
      SessionActivity(title: '${j['title'] ?? ''}', mins: _int(j['mins'], 10));
  Map<String, dynamic> toJson() => {'title': title, 'mins': mins};
  @override
  List<Object?> get props => [title, mins];
}

enum SessionStatus { planned, taught, skipped }

/// One class period of a plan: when (date + timetable slot), what (focus, steps, homework) and how it went.
class LessonSession extends Equatable {
  const LessonSession({
    required this.id,
    this.date = '',
    this.slot = '',
    this.focus = '',
    this.activities = const [],
    this.homework = '',
    this.status = SessionStatus.planned,
    this.note = '',
    this.taughtAt = '',
  });
  final String id, date, slot, focus, homework, note, taughtAt;
  final List<SessionActivity> activities;
  final SessionStatus status;

  bool get taught => status == SessionStatus.taught;
  bool get open => status == SessionStatus.planned;
  int get mins => activities.fold(0, (a, e) => a + e.mins);

  factory LessonSession.fromJson(Map<String, dynamic> j) => LessonSession(
    id: '${j['id'] ?? ''}',
    date: '${j['date'] ?? ''}',
    slot: '${j['slot'] ?? ''}',
    focus: '${j['focus'] ?? ''}',
    activities: [for (final a in _maps(j['activities'])) SessionActivity.fromJson(a)],
    homework: '${j['homework'] ?? ''}',
    status: SessionStatus.values.asNameMap()[j['status']] ?? SessionStatus.planned,
    note: '${j['note'] ?? ''}',
    taughtAt: '${j['taughtAt'] ?? ''}',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'date': date,
    'slot': slot,
    'focus': focus,
    'activities': [for (final a in activities) a.toJson()],
    'homework': homework,
    'status': status.name,
    'note': note,
    'taughtAt': taughtAt,
  };
  LessonSession copyWith({
    String? date,
    String? slot,
    String? focus,
    List<SessionActivity>? activities,
    String? homework,
    SessionStatus? status,
    String? note,
    String? taughtAt,
  }) => LessonSession(
    id: id,
    date: date ?? this.date,
    slot: slot ?? this.slot,
    focus: focus ?? this.focus,
    activities: activities ?? this.activities,
    homework: homework ?? this.homework,
    status: status ?? this.status,
    note: note ?? this.note,
    taughtAt: taughtAt ?? this.taughtAt,
  );

  @override
  List<Object?> get props => [id, date, slot, focus, activities, homework, status, note, taughtAt];
}

enum ReviewState { none, submitted, approved, changes }

/// HOD / admin review of a plan (the admin web writes approved / changes with a note).
class LessonReview extends Equatable {
  const LessonReview({
    this.state = ReviewState.none,
    this.note = '',
    this.by = '',
    this.at = '',
    this.submittedAt = '',
  });
  final ReviewState state;
  final String note, by, at, submittedAt;
  factory LessonReview.fromJson(Object? v) {
    if (v is! Map) return const LessonReview();
    final j = Map<String, dynamic>.from(v);
    return LessonReview(
      state: ReviewState.values.asNameMap()[j['state']] ?? ReviewState.none,
      note: '${j['note'] ?? ''}',
      by: '${j['by'] ?? ''}',
      at: '${j['at'] ?? ''}',
      submittedAt: '${j['submittedAt'] ?? ''}',
    );
  }
  Map<String, dynamic> toJson() => {'state': state.name, 'note': note, 'by': by, 'at': at, 'submittedAt': submittedAt};
  @override
  List<Object?> get props => [state, note, by, at, submittedAt];
}

/// A lesson plan (collection `ls_plans`): a chapter / unit of one subject in one class, taught over [sessions].
class LessonPlan extends Equatable {
  const LessonPlan({
    required this.id,
    this.code = '',
    required this.cls,
    this.classId = '',
    required this.subject,
    required this.title,
    this.chapter = '',
    this.summary = '',
    this.outcomes = const [],
    this.sessions = const [],
    this.attachments = const [],
    this.draft = false,
    this.review = const LessonReview(),
    this.copiedFrom = '',
    this.updatedAt = '',
  });

  final String id, code, cls, classId, subject, title, chapter, summary, copiedFrom, updatedAt;
  final List<String> outcomes;
  final List<LessonSession> sessions;
  final List<FileRef> attachments;
  final bool draft;
  final LessonReview review;

  int get taughtCount => sessions.where((s) => s.taught).length;

  /// Sessions that still count (skipped ones do not).
  int get plannedCount => sessions.where((s) => s.status != SessionStatus.skipped).length;
  double get progress => plannedCount == 0 ? 0 : taughtCount / plannedCount;
  bool get completed => !draft && plannedCount > 0 && taughtCount >= plannedCount;

  /// Published and not finished.
  bool get isActive => !draft && !completed;

  /// The next session still to teach: dated today or later first, then any undated one.
  LessonSession? nextSession(String today) {
    final open = sessions.where((s) => s.open).toList();
    return open.where((s) => s.date.compareTo(today) >= 0).firstOrNull ??
        open.where((s) => s.date.isEmpty).firstOrNull ??
        open.firstOrNull;
  }

  List<LessonSession> sessionsOn(String day) => [
    for (final s in sessions)
      if (s.date == day) s,
  ];
  int indexOf(LessonSession s) => sessions.indexWhere((x) => x.id == s.id);

  factory LessonPlan.fromJson(Map<String, dynamic> j) {
    var sessions = [for (final m in _maps(j['sessions'])) LessonSession.fromJson(m)];
    var outcomes = _strs(j['outcomes']);
    // plans saved before sessions existed: one session per milestone (or a single one), objectives become outcomes
    if (sessions.isEmpty && (j['milestones'] is List || j['activities'] is List)) {
      final ms = _maps(j['milestones']);
      final acts = [
        for (final a in _maps(j['activities']))
          SessionActivity(title: '${a['title'] ?? ''}', mins: _int(a['mins'], 10)),
      ];
      sessions = [
        for (var i = 0; i < (ms.isEmpty ? 1 : ms.length); i++)
          LessonSession(
            id: 's${i + 1}',
            date: i == 0 ? '${j['date'] ?? ''}' : '',
            focus: ms.isEmpty ? '${j['title'] ?? ''}' : '${ms[i]['title'] ?? ''}',
            activities: i == 0 ? acts : const [],
            status: ms.isNotEmpty && ms[i]['done'] == true ? SessionStatus.taught : SessionStatus.planned,
          ),
      ];
    }
    if (outcomes.isEmpty) {
      outcomes = [
        for (final o in _maps(j['objectives'])) '${o['title'] ?? ''}',
        if ('${j['outcome'] ?? ''}'.trim().isNotEmpty) '${j['outcome']}',
      ].where((s) => s.trim().isNotEmpty).toList();
    }
    return LessonPlan(
      id: '${j['id'] ?? ''}',
      code: '${j['code'] ?? ''}',
      cls: '${j['cls'] ?? ''}',
      classId: '${j['classId'] ?? ''}',
      subject: '${j['subject'] ?? ''}',
      title: '${j['title'] ?? ''}',
      chapter: '${j['chapter'] ?? j['ncert'] ?? ''}',
      summary: '${j['summary'] ?? ''}',
      outcomes: outcomes,
      sessions: sessions,
      attachments: [for (final a in _maps(j['attachments'])) FileRef.fromJson(a)],
      draft: j['draft'] == true,
      review: LessonReview.fromJson(j['review']),
      copiedFrom: '${j['copiedFrom'] ?? ''}',
      updatedAt: '${j['updatedAt'] ?? ''}',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'cls': cls,
    'classId': classId,
    'subject': subject,
    'title': title,
    'chapter': chapter,
    'summary': summary,
    'outcomes': outcomes,
    'sessions': [for (final s in sessions) s.toJson()],
    'attachments': [for (final a in attachments) a.toJson()],
    'draft': draft,
    'review': review.toJson(),
    'copiedFrom': copiedFrom,
    // what the dashboard lists without reading sessions
    'stage': completed ? 'completed' : (draft ? 'draft' : 'active'),
    'sessionCount': plannedCount,
    'taughtCount': taughtCount,
  };

  LessonPlan copyWith({
    String? id,
    String? code,
    String? cls,
    String? classId,
    String? subject,
    String? title,
    String? chapter,
    String? summary,
    List<String>? outcomes,
    List<LessonSession>? sessions,
    List<FileRef>? attachments,
    bool? draft,
    LessonReview? review,
    String? copiedFrom,
  }) => LessonPlan(
    id: id ?? this.id,
    code: code ?? this.code,
    cls: cls ?? this.cls,
    classId: classId ?? this.classId,
    subject: subject ?? this.subject,
    title: title ?? this.title,
    chapter: chapter ?? this.chapter,
    summary: summary ?? this.summary,
    outcomes: outcomes ?? this.outcomes,
    sessions: sessions ?? this.sessions,
    attachments: attachments ?? this.attachments,
    draft: draft ?? this.draft,
    review: review ?? this.review,
    copiedFrom: copiedFrom ?? this.copiedFrom,
    updatedAt: updatedAt,
  );

  @override
  List<Object?> get props => [
    id,
    code,
    cls,
    classId,
    subject,
    title,
    chapter,
    summary,
    outcomes,
    sessions,
    attachments,
    draft,
    review,
    copiedFrom,
    updatedAt,
  ];
}

/// Dates for [count] sessions from [from] (ISO day): the teacher's own timetable periods of this class and subject,
/// in order, skipping [taken] ("date|slot") ones. [periods] are (weekday 1-7, slot id) pairs.
List<({String date, String slot})> suggestSessionDates({
  required List<({int day, String slot})> periods,
  required String from,
  required int count,
  Set<String> taken = const {},
  int maxDays = 120,
  bool Function(String date, String slot)? skip,
}) {
  final out = <({String date, String slot})>[];
  final start = DateTime.tryParse(from);
  if (start == null || periods.isEmpty || count <= 0) return out;
  int order(String slot) => int.tryParse(slot.replaceAll(RegExp(r'\D'), '')) ?? 0;
  final sorted = [...periods]..sort((a, b) => order(a.slot).compareTo(order(b.slot)));
  for (var d = 0; d < maxDays && out.length < count; d++) {
    final day = DateTime(start.year, start.month, start.day + d);
    final iso = '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    for (final p in sorted) {
      if (p.day != day.weekday || taken.contains('$iso|${p.slot}') || (skip?.call(iso, p.slot) ?? false)) continue;
      out.add((date: iso, slot: p.slot));
      if (out.length >= count) break;
    }
  }
  return out;
}
