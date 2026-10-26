import 'package:equatable/equatable.dart';

class SyllabusTopic extends Equatable {
  const SyllabusTopic(this.name, this.done, this.total);
  final String name;
  final int done, total;

  bool get isComplete => total > 0 && done >= total;
  int get pct => total == 0 ? 0 : (done * 100 / total).round();

  factory SyllabusTopic.fromJson(Map<String, dynamic> j) => SyllabusTopic(j['name'] as String? ?? '', (j['done'] as num?)?.toInt() ?? 0, (j['total'] as num?)?.toInt() ?? 0);
  Map<String, dynamic> toJson() => {'name': name, 'done': done, 'total': total};
  @override
  List<Object?> get props => [name, done, total];
}

/// One cohort's syllabus log (`tk_syllabus`).
class SyllabusDivision extends Equatable {
  const SyllabusDivision({required this.id, required this.cls, required this.subject, this.hours = 0, this.labs = 0, this.lag = 0, this.note = '', this.remedial, this.topics = const []});
  final String id, cls, subject, note;
  final String? remedial;
  final int hours, labs, lag;
  final List<SyllabusTopic> topics;

  factory SyllabusDivision.fromJson(Map<String, dynamic> j) => SyllabusDivision(
        id: j['id'] as String? ?? '', cls: j['cls'] as String? ?? '', subject: j['subject'] as String? ?? '', hours: (j['hours'] as num?)?.toInt() ?? 0,
        labs: (j['labs'] as num?)?.toInt() ?? 0, lag: (j['lag'] as num?)?.toInt() ?? 0, note: j['note'] as String? ?? '', remedial: j['remedial'] as String?,
        topics: [for (final t in (j['topics'] as List? ?? const [])) SyllabusTopic.fromJson(Map<String, dynamic>.from(t as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'cls': cls, 'subject': subject, 'hours': hours, 'labs': labs, 'lag': lag, 'note': note, 'remedial': ?remedial,
        'topics': [for (final t in topics) t.toJson()],
      };

  @override
  List<Object?> get props => [id, cls, subject, hours, labs, lag, note, remedial, topics];
}

/// Submission state of the monthly progress log (`tk_syllabus_meta`, single document).
class SyllabusMeta extends Equatable {
  const SyllabusMeta({this.status = 'draft', this.target = 80, this.due, this.submittedAt});
  final String status;
  final int target;
  final String? due, submittedAt;

  bool get submitted => status == 'submitted';

  factory SyllabusMeta.fromJson(Map<String, dynamic> j) {
    final t = (j['target'] as num?)?.toInt() ?? 0;
    return SyllabusMeta(status: j['status'] as String? ?? 'draft', target: t == 0 ? 80 : t, due: j['due'] as String?, submittedAt: j['submittedAt'] as String?);
  }

  @override
  List<Object?> get props => [status, target, due, submittedAt];
}
