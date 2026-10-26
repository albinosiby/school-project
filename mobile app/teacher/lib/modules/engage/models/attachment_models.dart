import 'package:equatable/equatable.dart';

/// A file reference (attachment, material, slip) shown as a file chip. Nothing is uploaded (simulated).
class FileRef extends Equatable {
  const FileRef({required this.name, this.size = '', this.src = ''});
  final String name, size, src;

  static FileRef? maybe(Object? j) => j is Map ? FileRef.fromJson(Map<String, dynamic>.from(j)) : null;

  factory FileRef.fromJson(Map<String, dynamic> j) => FileRef(name: '${j['name'] ?? ''}', size: '${j['size'] ?? ''}', src: '${j['src'] ?? ''}');
  Map<String, dynamic> toJson() => {'name': name, 'size': size, if (src.isNotEmpty) 'src': src};

  FileRef copyWith({String? name, String? size, String? src}) => FileRef(name: name ?? this.name, size: size ?? this.size, src: src ?? this.src);

  @override
  List<Object?> get props => [name, size, src];
}
