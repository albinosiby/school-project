import 'package:equatable/equatable.dart';

/// A published `com_notices` row the transport crew may see (contract 14.6).
class Notice extends Equatable {
  const Notice({required this.id, required this.title, this.body = '', this.category = '', this.audience = '', this.author = '', this.sentAt, this.urgent = false, this.pinned = false});
  final String id, title, body, category, audience, author;
  final DateTime? sentAt;
  final bool urgent, pinned;

  /// Transport crew see notices addressed to transport, staff, drivers, everyone (contract 14.6).
  bool get forCrew => RegExp(r'transport|staff|driver|bus|all|everyone|whole', caseSensitive: false).hasMatch(audience);

  factory Notice.fromJson(Map<String, dynamic> j, {String? id}) => Notice(
    id: id ?? '${j['id'] ?? ''}', title: '${j['title'] ?? ''}', body: '${j['body'] ?? ''}', category: '${j['category'] ?? ''}',
    audience: '${j['audience'] ?? ''}', author: '${j['author'] ?? ''}',
    sentAt: DateTime.tryParse('${j['sentAt'] ?? ''}')?.toLocal(), urgent: j['urgent'] == true, pinned: j['pinned'] == true,
  );

  @override
  List<Object?> get props => [id, title, body, category, audience, author, sentAt, urgent, pinned];
}
