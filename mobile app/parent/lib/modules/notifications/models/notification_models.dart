import 'package:equatable/equatable.dart';

/// Source of a notification (Figma "7. Notifications" eyebrow labels).
enum NotificationCategory { transit, academic, fees, emergency, merit, notice }

extension NotificationCategoryX on NotificationCategory {
  String get label => switch (this) {
    NotificationCategory.transit => 'Transit & Route',
    NotificationCategory.academic => 'Curriculum & Exams',
    NotificationCategory.fees => 'Bursar & Accounts',
    NotificationCategory.emergency => 'Emergency',
    NotificationCategory.merit => 'Merit Recognition',
    NotificationCategory.notice => 'School Notice',
  };
}

/// Filter chips of the notification centre.
enum NotificationFilter { all, unread, academic, transit, fees, emergency, notices }

extension NotificationFilterX on NotificationFilter {
  String get label => switch (this) {
    NotificationFilter.all => 'All',
    NotificationFilter.unread => 'Unread',
    NotificationFilter.academic => 'Academic',
    NotificationFilter.transit => 'Transit & GPS',
    NotificationFilter.fees => 'Fee Reminders',
    NotificationFilter.emergency => 'Emergency',
    NotificationFilter.notices => 'Notices',
  };

  bool matches(AppNotification n) => switch (this) {
    NotificationFilter.all => true,
    NotificationFilter.unread => !n.read,
    NotificationFilter.academic => n.category == NotificationCategory.academic,
    NotificationFilter.transit => n.category == NotificationCategory.transit,
    NotificationFilter.fees => n.category == NotificationCategory.fees,
    NotificationFilter.emergency =>
      n.category == NotificationCategory.emergency,
    NotificationFilter.notices => n.noticeId != null,
  };
}

/// One entry of the guardian's notification centre. School notices (modules/notices) appear here
/// with [noticeId] set; acknowledging them writes through the notice repository.
class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.category,
    required this.title,
    required this.time,
    this.summary,
    this.body = '',
    this.from,
    this.childLabel,
    this.reference,
    this.actionLabel,
    this.actionRoute,
    this.noticeId,
    this.requiresAck = false,
    this.acknowledged = false,
    this.read = false,
  });

  final String id, title, body;
  final NotificationCategory category;
  final DateTime time;
  final String? summary, from, childLabel, reference;

  /// Deep link of the action button (a `RoutePaths` location).
  final String? actionLabel, actionRoute;
  final String? noticeId;
  final bool requiresAck, acknowledged, read;

  bool get needsAction => requiresAck && !acknowledged;

  AppNotification copyWith({bool? read, bool? acknowledged}) => AppNotification(
    id: id,
    category: category,
    title: title,
    time: time,
    summary: summary,
    body: body,
    from: from,
    childLabel: childLabel,
    reference: reference,
    actionLabel: actionLabel,
    actionRoute: actionRoute,
    noticeId: noticeId,
    requiresAck: requiresAck,
    acknowledged: acknowledged ?? this.acknowledged,
    read: read ?? this.read,
  );

  @override
  List<Object?> get props => [
    id,
    category,
    title,
    time,
    summary,
    body,
    from,
    childLabel,
    reference,
    actionLabel,
    actionRoute,
    noticeId,
    requiresAck,
    acknowledged,
    read,
  ];
}
