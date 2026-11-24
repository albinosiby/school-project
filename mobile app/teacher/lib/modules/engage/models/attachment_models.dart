import 'package:equatable/equatable.dart';

/// A file attached to a message or material. Uploaded chat attachments carry a Storage [url] (and [path]);
/// [kind] is `image`, `file` or `audio` (voice note, with [durationMs]). Seeded demo rows have no url.
class FileRef extends Equatable {
  const FileRef({required this.name, this.size = '', this.src = '', this.kind = '', this.url = '', this.path = '', this.contentType = '', this.bytes = 0, this.durationMs = 0});
  final String name, size, src, kind, url, path, contentType;
  final int bytes, durationMs;

  bool get isImage => kind == 'image' || contentType.startsWith('image/');
  bool get isAudio => kind == 'audio' || contentType.startsWith('audio/');
  bool get uploaded => url.isNotEmpty;
  Duration get duration => Duration(milliseconds: durationMs);

  static FileRef? maybe(Object? j) => j is Map ? FileRef.fromJson(Map<String, dynamic>.from(j)) : null;

  /// Human size from [bytes] when no label was given.
  static String sizeLabel(int bytes) => bytes <= 0 ? '' : bytes < 1024 * 1024 ? '${(bytes / 1024).ceil()} KB' : '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';

  factory FileRef.fromJson(Map<String, dynamic> j) {
    final bytes = (j['bytes'] as num?)?.toInt() ?? 0;
    return FileRef(
      name: '${j['name'] ?? ''}',
      size: '${j['size'] ?? ''}'.isEmpty ? sizeLabel(bytes) : '${j['size']}',
      src: '${j['src'] ?? ''}',
      kind: '${j['kind'] ?? ''}',
      url: '${j['url'] ?? ''}',
      path: '${j['path'] ?? ''}',
      contentType: '${j['contentType'] ?? ''}',
      bytes: bytes,
      durationMs: (j['durationMs'] as num?)?.toInt() ?? 0,
    );
  }
  Map<String, dynamic> toJson() => {
        'name': name,
        'size': size,
        if (src.isNotEmpty) 'src': src,
        if (kind.isNotEmpty) 'kind': kind,
        if (url.isNotEmpty) 'url': url,
        if (path.isNotEmpty) 'path': path,
        if (contentType.isNotEmpty) 'contentType': contentType,
        if (bytes > 0) 'bytes': bytes,
        if (durationMs > 0) 'durationMs': durationMs,
      };

  FileRef copyWith({String? name, String? size, String? src, String? kind, String? url, String? path, String? contentType, int? bytes, int? durationMs}) => FileRef(
        name: name ?? this.name, size: size ?? this.size, src: src ?? this.src, kind: kind ?? this.kind, url: url ?? this.url, path: path ?? this.path,
        contentType: contentType ?? this.contentType, bytes: bytes ?? this.bytes, durationMs: durationMs ?? this.durationMs,
      );

  @override
  List<Object?> get props => [name, size, src, kind, url, path, contentType, bytes, durationMs];
}
