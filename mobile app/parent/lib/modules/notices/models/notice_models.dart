import 'package:equatable/equatable.dart';

enum NoticeCategory { general, event, holiday, exam, urgent }

extension NoticeCategoryX on NoticeCategory {
  String get label => switch (this) {
    NoticeCategory.general => 'General',
    NoticeCategory.event => 'Event',
    NoticeCategory.holiday => 'Holiday',
    NoticeCategory.exam => 'Exam',
    NoticeCategory.urgent => 'Urgent',
  };
}

class Notice extends Equatable {
  const Notice({
    required this.id,
    required this.title,
    required this.body,
    required this.date,
    required this.from,
    this.category = NoticeCategory.general,
    this.requiresAck = false,
    this.acknowledged = false,
  });
  final String id, title, body, from;
  final DateTime date;
  final NoticeCategory category;
  final bool requiresAck, acknowledged;

  bool get needsAction => requiresAck && !acknowledged;

  Notice acknowledge() => Notice(
    id: id,
    title: title,
    body: body,
    date: date,
    from: from,
    category: category,
    requiresAck: requiresAck,
    acknowledged: true,
  );

  @override
  List<Object?> get props => [
    id,
    title,
    body,
    date,
    from,
    category,
    requiresAck,
    acknowledged,
  ];
}
