import 'package:equatable/equatable.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

/// Syllabus pacing of one class (topics done / total). Collection `cl_pacing`, id = classId.
class ClassPacing extends Equatable {
  const ClassPacing({required this.id, required this.done, required this.total});
  final String id;
  final int done, total;

  int get pct => total == 0 ? 0 : (done * 100 / total).round();

  factory ClassPacing.fromJson(Map<String, dynamic> j) => ClassPacing(id: j['id'] as String, done: _int(j['done']), total: _int(j['total']));
  Map<String, dynamic> toJson() => {'id': id, 'done': done, 'total': total};
  ClassPacing copyWith({int? done, int? total}) => ClassPacing(id: id, done: done ?? this.done, total: total ?? this.total);

  @override
  List<Object?> get props => [id, done, total];
}

/// Behaviour badge (praise / guidance flag / pastoral note). Collection `cl_badges`.
class BehaviourBadge extends Equatable {
  const BehaviourBadge({this.id = '', required this.name, required this.kind, required this.category, required this.icon, required this.theme, required this.merits, this.custom = false});
  final String id, name, kind, category, icon, theme;
  final int merits;
  final bool custom;

  factory BehaviourBadge.fromJson(Map<String, dynamic> j) => BehaviourBadge(
        id: j['id'] as String? ?? '', name: j['name'] as String? ?? '', kind: j['kind'] as String? ?? 'praise', category: j['category'] as String? ?? '',
        icon: j['icon'] as String? ?? 'trophy', theme: j['theme'] as String? ?? '', merits: _int(j['merits']), custom: j['custom'] == true,
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'name': name, 'kind': kind, 'category': category, 'icon': icon, 'theme': theme, 'merits': merits, if (custom) 'custom': true,
      };

  @override
  List<Object?> get props => [id, name, kind, category, icon, theme, merits, custom];
}

/// A conduct record. Collection `cl_behaviour`. `kind` is praise | flag | note.
class BehaviourLog extends Equatable {
  const BehaviourLog({
    this.id = '', required this.studentId, required this.classId, required this.kind, required this.badge, required this.context, required this.note,
    required this.merits, required this.teacher, required this.at, required this.status, this.extra = const {},
  });
  final String id, studentId, classId, kind, badge, context, note, teacher, at, status;
  final int merits;
  /// notify, dossier, nominated, attachment, …
  final Map<String, dynamic> extra;

  static const _known = {'id', 'studentId', 'classId', 'kind', 'badge', 'context', 'note', 'merits', 'teacher', 'at', 'status'};

  DateTime get time => DateTime.tryParse(at) ?? DateTime(2000);

  factory BehaviourLog.fromJson(Map<String, dynamic> j) => BehaviourLog(
        id: j['id'] as String? ?? '', studentId: j['studentId'] as String? ?? '', classId: j['classId'] as String? ?? '', kind: j['kind'] as String? ?? 'note',
        badge: j['badge'] as String? ?? '', context: j['context'] as String? ?? '', note: j['note'] as String? ?? '', merits: _int(j['merits']),
        teacher: j['teacher'] as String? ?? '', at: j['at'] as String? ?? '', status: j['status'] as String? ?? '',
        extra: {for (final e in j.entries) if (!_known.contains(e.key)) e.key: e.value},
      );
  Map<String, dynamic> toJson() => {
        ...extra, if (id.isNotEmpty) 'id': id, 'studentId': studentId, 'classId': classId, 'kind': kind, 'badge': badge, 'context': context, 'note': note,
        'merits': merits, 'teacher': teacher, 'at': at, 'status': status,
      };
  BehaviourLog copyWith({String? status}) => BehaviourLog.fromJson({...toJson(), 'id': id, 'status': ?status});

  @override
  List<Object?> get props => [id, studentId, classId, kind, badge, context, note, merits, teacher, at, status, extra];
}

/// A file shared with a class. Collection `cl_resources`.
class SharedResource extends Equatable {
  const SharedResource({
    this.id = '', required this.classId, required this.title, required this.category, required this.subtitle, required this.sizeKb, required this.tag,
    this.tagTone = 'brand', required this.uploadedAt, this.pinned = false, this.isNew = false, this.downloaded = 0, this.shares = 0, this.ext = 'pdf', this.stat = '',
  });
  final String id, classId, title, category, subtitle, tag, tagTone, uploadedAt, ext, stat;
  final num sizeKb;
  final bool pinned, isNew;
  final int downloaded, shares;

  factory SharedResource.fromJson(Map<String, dynamic> j) => SharedResource(
        id: j['id'] as String? ?? '', classId: j['classId'] as String? ?? '', title: j['title'] as String? ?? '', category: j['category'] as String? ?? '',
        subtitle: j['subtitle'] as String? ?? '', sizeKb: j['sizeKb'] as num? ?? 0, tag: j['tag'] as String? ?? '', tagTone: j['tagTone'] as String? ?? 'brand',
        uploadedAt: j['uploadedAt'] as String? ?? '', pinned: j['pinned'] == true, isNew: j['isNew'] == true, downloaded: _int(j['downloaded']),
        shares: _int(j['shares']), ext: j['ext'] as String? ?? 'pdf', stat: j['stat'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'classId': classId, 'title': title, 'category': category, 'subtitle': subtitle, 'sizeKb': sizeKb, 'tag': tag,
        'tagTone': tagTone, 'uploadedAt': uploadedAt, 'pinned': pinned, 'isNew': isNew, 'downloaded': downloaded, 'shares': shares, 'ext': ext, 'stat': stat,
      };
  SharedResource copyWith({bool? pinned, int? downloaded, int? shares}) =>
      SharedResource.fromJson({...toJson(), 'id': id, 'pinned': ?pinned, 'downloaded': ?downloaded, 'shares': ?shares});

  @override
  List<Object?> get props => [id, classId, title, category, sizeKb, tag, uploadedAt, pinned, isNew, downloaded, shares, ext];
}

/// A document in a student's vault. Collection `cl_documents`.
class StudentDocument extends Equatable {
  const StudentDocument({this.id = '', required this.studentId, required this.group, required this.title, required this.meta, this.tag = ''});
  final String id, studentId, group, title, meta, tag;

  factory StudentDocument.fromJson(Map<String, dynamic> j) => StudentDocument(
        id: j['id'] as String? ?? '', studentId: j['studentId'] as String? ?? '', group: j['group'] as String? ?? '', title: j['title'] as String? ?? '',
        meta: j['meta'] as String? ?? '', tag: j['tag'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {if (id.isNotEmpty) 'id': id, 'studentId': studentId, 'group': group, 'title': title, 'meta': meta, 'tag': tag};

  @override
  List<Object?> get props => [id, studentId, group, title, meta, tag];
}

/// A document requested from a student's guardians. Collection `cl_doc_requests`.
class DocumentRequest extends Equatable {
  const DocumentRequest({this.id = '', required this.studentId, required this.doc, required this.due, this.priority = 'Normal', this.note = '', this.notify = true, this.status = 'pending', required this.createdAt});
  final String id, studentId, doc, due, priority, note, status, createdAt;
  final bool notify;

  factory DocumentRequest.fromJson(Map<String, dynamic> j) => DocumentRequest(
        id: j['id'] as String? ?? '', studentId: j['studentId'] as String? ?? '', doc: j['doc'] as String? ?? '', due: j['due'] as String? ?? '',
        priority: j['priority'] as String? ?? 'Normal', note: j['note'] as String? ?? '', notify: j['notify'] != false, status: j['status'] as String? ?? 'pending',
        createdAt: j['createdAt'] as String? ?? '',
      );
  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id, 'studentId': studentId, 'doc': doc, 'due': due, 'priority': priority, 'note': note, 'notify': notify, 'status': status, 'createdAt': createdAt,
      };

  @override
  List<Object?> get props => [id, studentId, doc, due, priority, note, notify, status, createdAt];
}
