import 'package:equatable/equatable.dart';

class AppNotification extends Equatable {
  const AppNotification({required this.id, required this.type, required this.category, required this.tag, required this.title, required this.body, required this.at, required this.read, this.route});
  final String id, type, category, tag, title, body, at;
  final bool read;
  /// Module route to open from the notification detail.
  final String? route;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as String, type: j['type'] as String? ?? '', category: j['category'] as String? ?? '', tag: j['tag'] as String? ?? '',
        title: j['title'] as String? ?? '', body: j['body'] as String? ?? '', at: j['at'] as String? ?? '', read: j['read'] == true, route: j['route'] as String?,
      );
  Map<String, dynamic> toJson() => {'id': id, 'type': type, 'category': category, 'tag': tag, 'title': title, 'body': body, 'at': at, 'read': read, 'route': ?route};

  @override
  List<Object?> get props => [id, type, category, tag, title, body, at, read, route];
}
