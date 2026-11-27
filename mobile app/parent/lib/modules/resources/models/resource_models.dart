import 'package:equatable/equatable.dart';

enum ResourceKind { file, youtube, link }

/// The YouTube video id of [url] (youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID), else null.
String? youtubeId(String url) {
  final u = Uri.tryParse(url.trim());
  if (u == null) return null;
  final host = u.host.toLowerCase().replaceFirst('www.', '').replaceFirst('m.', '');
  String? id;
  if (host == 'youtu.be') {
    id = u.pathSegments.isEmpty ? null : u.pathSegments.first;
  } else if (host == 'youtube.com' || host == 'music.youtube.com' || host == 'youtube-nocookie.com') {
    final seg = u.pathSegments;
    if (seg.isNotEmpty && seg.first == 'watch') {
      id = u.queryParameters['v'];
    } else if (seg.length >= 2 && const {'shorts', 'embed', 'live', 'v'}.contains(seg.first)) {
      id = seg[1];
    }
  }
  return id != null && RegExp(r'^[A-Za-z0-9_-]{6,20}$').hasMatch(id) ? id : null;
}

/// A resource the child's teacher shared with the class (`cl_resources`, visibility `parents`).
class ClassResource extends Equatable {
  const ClassResource({
    required this.id,
    required this.title,
    required this.kind,
    required this.url,
    this.description = '',
    this.subject = '',
    this.teacher = '',
    this.fileName = '',
    this.mime = '',
    this.sizeBytes = 0,
    this.pinned = false,
    this.createdAt,
  });
  final String id, title, url, description, subject, teacher, fileName, mime;
  final ResourceKind kind;
  final int sizeBytes;
  final bool pinned;
  final DateTime? createdAt;

  String? get videoId => kind == ResourceKind.youtube ? youtubeId(url) : null;
  String? get thumbnail => videoId == null ? null : 'https://img.youtube.com/vi/$videoId/hqdefault.jpg';
  bool get isDrive => kind == ResourceKind.link && RegExp(r'(drive|docs)\.google\.com').hasMatch(url);

  /// Lower-case extension of the file name (or of the URL path for links).
  String get ext {
    final n = (fileName.isNotEmpty ? fileName : Uri.tryParse(url)?.path ?? '').toLowerCase();
    final i = n.lastIndexOf('.');
    return i < 0 || i == n.length - 1 ? '' : n.substring(i + 1);
  }

  /// pdf, word, slides, sheet, image, video, drive, link or file.
  String get type {
    if (kind == ResourceKind.youtube) return 'video';
    if (isDrive) return 'drive';
    if (kind == ResourceKind.link) return 'link';
    final m = mime.toLowerCase(), e = ext;
    if (m == 'application/pdf' || e == 'pdf') return 'pdf';
    if (m.startsWith('image/') || const {'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'}.contains(e)) return 'image';
    if (m.startsWith('video/') || const {'mp4', 'mov', 'm4v', 'webm'}.contains(e)) return 'video';
    if (m.contains('presentation') || m.contains('powerpoint') || const {'ppt', 'pptx', 'key', 'odp'}.contains(e)) return 'slides';
    if (m.contains('word') || const {'doc', 'docx', 'odt', 'rtf'}.contains(e)) return 'word';
    if (m.contains('sheet') || m.contains('excel') || const {'xls', 'xlsx', 'csv', 'ods'}.contains(e)) return 'sheet';
    return 'file';
  }

  String get sizeLabel => sizeBytes <= 0
      ? ''
      : sizeBytes < 1024 * 1024
      ? '${(sizeBytes / 1024).ceil()} KB'
      : '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';

  /// [d] is a `cl_resources` doc; null when it is not shareable (no url / not for parents).
  static ClassResource? fromDoc(String id, Map<String, dynamic> d) {
    if ('${d['visibility'] ?? ''}' != 'parents' || d['deleted'] == true) return null;
    final url = '${d['url'] ?? ''}'.trim();
    if (!url.startsWith('http')) return null;
    final kind = switch ('${d['kind'] ?? ''}') {
      'youtube' => ResourceKind.youtube,
      'link' => ResourceKind.link,
      _ => ResourceKind.file,
    };
    return ClassResource(
      id: id,
      title: '${d['title'] ?? ''}'.trim().isEmpty ? '${d['fileName'] ?? 'Resource'}' : '${d['title']}'.trim(),
      kind: kind == ResourceKind.link && youtubeId(url) != null ? ResourceKind.youtube : kind,
      url: url,
      description: '${d['description'] ?? ''}',
      subject: '${d['subject'] ?? ''}',
      teacher: '${d['teacher'] ?? ''}',
      fileName: '${d['fileName'] ?? ''}',
      mime: '${d['mime'] ?? ''}',
      sizeBytes: (d['sizeBytes'] as num?)?.toInt() ?? 0,
      pinned: d['pinned'] == true,
      createdAt: DateTime.tryParse('${d['createdAt'] ?? ''}'),
    );
  }

  /// Pinned first, then newest.
  static List<ClassResource> sorted(Iterable<ClassResource> list) => [...list]
    ..sort((a, b) {
      if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
      final ta = a.createdAt, tb = b.createdAt;
      if (ta == null || tb == null) return ta == null ? (tb == null ? 0 : 1) : -1;
      return tb.compareTo(ta);
    });

  @override
  List<Object?> get props => [id, title, kind, url, description, subject, teacher, fileName, mime, sizeBytes, pinned, createdAt];
}
