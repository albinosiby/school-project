import 'package:equatable/equatable.dart';

/// Praise (merits) or guidance (demerits / incidents that the parent acknowledges).
enum ConductKind { praise, guidance }

enum ConductCategory {
  academic,
  diligence,
  civic,
  punctuality,
  sports,
  conduct,
}

class ConductEntry extends Equatable {
  const ConductEntry({
    required this.id,
    required this.childId,
    required this.title,
    required this.badge,
    required this.kind,
    required this.category,
    required this.teacher,
    required this.at,
    required this.merits,
    required this.note,
    this.tags = const [],
    this.verified,
    this.highlight,
    this.commendation = false,
    this.requiresAck = false,
    this.acknowledged = false,
    this.parentNote,
  });
  final String id, childId, title, badge, teacher, note;
  final ConductKind kind;
  final ConductCategory category;
  final DateTime at;

  /// Positive for praise, negative for guidance.
  final int merits;

  /// Footer chips ("Logged to Portfolio", "Classroom Practice").
  final List<String> tags;

  /// Verification chip ("Verified Entry", "Institutional Honor").
  final String? verified;

  /// Replaces the "+N Merits" pill (e.g. "100% On-Time").
  final String? highlight;
  final bool commendation, requiresAck, acknowledged;
  final String? parentNote;

  bool get isPraise => kind == ConductKind.praise;
  bool get needsAck => requiresAck && !acknowledged;
  String get meritLabel =>
      highlight ?? '${merits >= 0 ? '+' : ''}$merits Merits';

  /// The parent has seen the entry; [reply] is an optional note back to the teacher.
  ConductEntry acknowledge(String? reply) => ConductEntry(
    id: id,
    childId: childId,
    title: title,
    badge: badge,
    kind: kind,
    category: category,
    teacher: teacher,
    at: at,
    merits: merits,
    note: note,
    tags: tags,
    verified: verified,
    highlight: highlight,
    commendation: commendation,
    requiresAck: requiresAck,
    acknowledged: true,
    parentNote: reply == null || reply.trim().isEmpty ? null : reply.trim(),
  );

  @override
  List<Object?> get props => [
    id,
    childId,
    title,
    badge,
    kind,
    category,
    teacher,
    at,
    merits,
    note,
    tags,
    verified,
    highlight,
    commendation,
    requiresAck,
    acknowledged,
    parentNote,
  ];
}

class TeacherRemark extends Equatable {
  const TeacherRemark({
    required this.teacher,
    required this.subject,
    required this.text,
    required this.at,
  });
  final String teacher, subject, text;
  final DateTime at;

  @override
  List<Object?> get props => [teacher, subject, text, at];
}

/// Conduct filters of the activity log.
enum ConductFilter { all, praise, guidance, commendations }

extension ConductFilterX on ConductFilter {
  String get label => switch (this) {
    ConductFilter.all => 'All Entries',
    ConductFilter.praise => 'Praise & Stars',
    ConductFilter.guidance => 'Guidance & Notes',
    ConductFilter.commendations => 'Commendations',
  };
  bool matches(ConductEntry e) => switch (this) {
    ConductFilter.all => true,
    ConductFilter.praise => e.isPraise,
    ConductFilter.guidance => !e.isPraise,
    ConductFilter.commendations => e.commendation,
  };
}

/// A child's conduct record: entries (newest first), teacher remarks and the derived pulse numbers.
class BehaviourReport extends Equatable {
  const BehaviourReport({
    required this.childId,
    required this.entries,
    required this.remarks,
    required this.rank,
    required this.percentile,
  });
  final String childId;
  final List<ConductEntry> entries;
  final List<TeacherRemark> remarks;
  final int rank;
  final String percentile;

  int count(ConductFilter f) => entries.where(f.matches).length;
  List<ConductEntry> filtered(ConductFilter f) =>
      entries.where(f.matches).toList();

  int get praiseStars => count(ConductFilter.praise);
  int get activeFlags => entries.where((e) => e.needsAck).length;
  int get meritsLogged => entries.fold(0, (s, e) => s + e.merits);

  /// Share of positive merit points among all merit points (0..100).
  int get positiveIndex {
    final pos = entries
        .where((e) => e.merits > 0)
        .fold(0, (s, e) => s + e.merits);
    final neg = entries
        .where((e) => e.merits < 0)
        .fold(0, (s, e) => s - e.merits);
    return pos + neg == 0 ? 100 : (pos / (pos + neg) * 100).round();
  }

  /// Praise entries from the last 7 days of [now].
  int newPraise(DateTime now) => entries
      .where((e) => e.isPraise && now.difference(e.at).inDays < 7)
      .length;

  DateTime? get lastUpdated => entries.isEmpty ? null : entries.first.at;

  BehaviourReport copyWith({List<ConductEntry>? entries}) => BehaviourReport(
    childId: childId,
    entries: entries ?? this.entries,
    remarks: remarks,
    rank: rank,
    percentile: percentile,
  );

  @override
  List<Object?> get props => [childId, entries, remarks, rank, percentile];
}
