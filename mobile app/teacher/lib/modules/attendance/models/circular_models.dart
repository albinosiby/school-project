import 'package:equatable/equatable.dart';

class CircularAttachment extends Equatable {
  const CircularAttachment({required this.name, required this.size});
  final String name, size;
  factory CircularAttachment.fromJson(Map<String, dynamic> j) => CircularAttachment(name: j['name'] as String? ?? '', size: j['size'] as String? ?? '');
  Map<String, dynamic> toJson() => {'name': name, 'size': size};
  @override
  List<Object?> get props => [name, size];
}

/// School circular. cat: Academic | Admin | Events | General.
class Circular extends Equatable {
  const Circular({required this.id, required this.ref, required this.cat, required this.title, required this.summary, this.author = '', this.office = '', required this.date, this.read = false, this.ack = false, this.pinned = false, this.audience = '', this.points = const [], this.attachment, this.ackAt});
  final String id, ref, cat, title, summary, author, office, date, audience;
  final bool read, ack, pinned;
  final List<String> points;
  final CircularAttachment? attachment;
  final String? ackAt;

  String get catLabel => switch (cat) { 'Admin' => 'Staff & Admin', 'Events' => 'Events & Sports', _ => cat };

  factory Circular.fromJson(Map<String, dynamic> j) => Circular(
        id: j['id'] as String, ref: j['ref'] as String? ?? '', cat: j['cat'] as String? ?? 'General', title: j['title'] as String? ?? '',
        summary: j['summary'] as String? ?? '', author: j['author'] as String? ?? '', office: j['office'] as String? ?? '', date: j['date'] as String? ?? '',
        read: j['read'] == true, ack: j['ack'] == true, pinned: j['pinned'] == true, audience: j['audience'] as String? ?? '',
        points: [for (final p in j['points'] as List? ?? const []) '$p'],
        attachment: j['attachment'] is Map ? CircularAttachment.fromJson(Map<String, dynamic>.from(j['attachment'] as Map)) : null,
        ackAt: j['ackAt'] as String?,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'ref': ref, 'cat': cat, 'title': title, 'summary': summary, 'author': author, 'office': office, 'date': date,
        'read': read, 'ack': ack, 'pinned': pinned, 'audience': audience, 'points': points, 'attachment': attachment?.toJson(), 'ackAt': ?ackAt,
      };
  Circular copyWith({bool? read, bool? ack, bool? pinned, String? ackAt}) => Circular(
        id: id, ref: ref, cat: cat, title: title, summary: summary, author: author, office: office, date: date, read: read ?? this.read,
        ack: ack ?? this.ack, pinned: pinned ?? this.pinned, audience: audience, points: points, attachment: attachment, ackAt: ackAt ?? this.ackAt,
      );
  @override
  List<Object?> get props => [id, ref, cat, title, date, read, ack, pinned, ackAt];
}
