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
enum ResourceKind { file, youtube, link }

/// YouTube video id from youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID (null otherwise).
String? youtubeId(String url) {
  final u = Uri.tryParse(url.trim());
  if (u == null || !u.hasScheme) return null;
  final host = u.host.replaceFirst('www.', '').replaceFirst('m.', '');
  String? id;
  if (host == 'youtu.be') {
    id = u.pathSegments.isEmpty ? null : u.pathSegments.first;
  } else if (host == 'youtube.com' || host == 'music.youtube.com') {
    id = u.queryParameters['v'];
    if (id == null && u.pathSegments.length >= 2 && const ['shorts', 'embed', 'live', 'v'].contains(u.pathSegments.first)) id = u.pathSegments[1];
  }
  return id != null && RegExp(r'^[A-Za-z0-9_-]{6,20}$').hasMatch(id) ? id : null;
}

/// A Google Drive / Docs / Slides / Sheets link.
bool isDriveLink(String url) => RegExp(r'^https?://(drive|docs)\.google\.com/').hasMatch(url.trim());

/// A class resource (collection `cl_resources`): a file the teacher uploaded, a YouTube video or a link (Google Drive
/// or any web page). [visibility] 'parents' shows it in the parent app for the class; 'private' keeps it to the teacher.
class SharedResource extends Equatable {
  const SharedResource({
    this.id = '',
    required this.classId,
    required this.title,
    this.description = '',
    this.subject = '',
    this.kind = ResourceKind.file,
    this.url = '',
    this.fileName = '',
    this.mime = '',
    this.sizeBytes = 0,
    this.path = '',
    this.visibility = 'private',
    this.pinned = false,
    this.teacher = '',
    this.createdAt = '',
  });
  final String id, classId, title, description, subject, url, fileName, mime, path, visibility, teacher, createdAt;
  final ResourceKind kind;
  final int sizeBytes;
  final bool pinned;

  bool get forParents => visibility == 'parents';
  String? get videoId => kind == ResourceKind.youtube ? youtubeId(url) : null;
  String get thumbnail => videoId == null ? '' : 'https://img.youtube.com/vi/$videoId/hqdefault.jpg';
  bool get isDrive => kind == ResourceKind.link && isDriveLink(url);

  /// pdf, doc, ppt, xls, image, or the file extension.
  String get fileType {
    final n = (fileName.isEmpty ? url : fileName).toLowerCase();
    if (mime.startsWith('image/') || RegExp(r'\.(png|jpe?g|webp|gif|heic)$').hasMatch(n)) return 'image';
    if (mime == 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (RegExp(r'\.(docx?|odt|rtf)$').hasMatch(n) || mime.contains('word')) return 'doc';
    if (RegExp(r'\.(pptx?|odp|key)$').hasMatch(n) || mime.contains('presentation') || mime.contains('powerpoint')) return 'ppt';
    if (RegExp(r'\.(xlsx?|ods|csv)$').hasMatch(n) || mime.contains('sheet') || mime.contains('excel')) return 'xls';
    final dot = n.lastIndexOf('.');
    return dot < 0 ? 'file' : n.substring(dot + 1);
  }

  factory SharedResource.fromJson(Map<String, dynamic> j) {
    // rows saved before kinds existed (title + ext + sizeKb) read as files kept to the teacher
    final legacyExt = '${j['ext'] ?? ''}';
    final title = '${j['title'] ?? ''}';
    return SharedResource(
      id: '${j['id'] ?? ''}',
      classId: '${j['classId'] ?? ''}',
      title: title,
      description: '${j['description'] ?? j['subtitle'] ?? ''}',
      subject: '${j['subject'] ?? j['category'] ?? ''}',
      kind: ResourceKind.values.asNameMap()[j['kind']] ?? ResourceKind.file,
      url: '${j['url'] ?? ''}',
      fileName: '${j['fileName'] ?? (legacyExt.isEmpty || title.toLowerCase().endsWith('.$legacyExt') ? title : '$title.$legacyExt')}',
      mime: '${j['mime'] ?? ''}',
      sizeBytes: (j['sizeBytes'] as num?)?.toInt() ?? (((j['sizeKb'] as num?) ?? 0) * 1024).round(),
      path: '${j['path'] ?? ''}',
      visibility: j['visibility'] == 'parents' ? 'parents' : 'private',
      pinned: j['pinned'] == true,
      teacher: '${j['teacher'] ?? ''}',
      createdAt: '${j['createdAt'] ?? j['uploadedAt'] ?? ''}',
    );
  }

  Map<String, dynamic> toJson() => {
    if (id.isNotEmpty) 'id': id,
    'classId': classId,
    'title': title,
    'description': description,
    'subject': subject,
    'kind': kind.name,
    'url': url,
    'fileName': fileName,
    'mime': mime,
    'sizeBytes': sizeBytes,
    'path': path,
    'visibility': visibility,
    'pinned': pinned,
    'teacher': teacher,
    'createdAt': createdAt,
    'updatedAt': DateTime.now().toIso8601String(),
  };

  SharedResource copyWith({String? title, String? description, String? subject, String? visibility, bool? pinned, String? url, String? classId}) =>
      SharedResource.fromJson({
        ...toJson(),
        'id': id,
        'title': ?title,
        'description': ?description,
        'subject': ?subject,
        'visibility': ?visibility,
        'pinned': ?pinned,
        'url': ?url,
        'classId': ?classId,
      });

  @override
  List<Object?> get props => [id, classId, title, description, subject, kind, url, fileName, mime, sizeBytes, path, visibility, pinned, teacher, createdAt];
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
