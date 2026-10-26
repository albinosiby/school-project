import '../../../config/routes/routes.dart';
import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../notices/models/notice_models.dart';
import '../models/notification_models.dart';

/// Demo notifications (relative to [now]) and the mapping of school notices into the feed.
class NotificationDemoData {
  NotificationDemoData._();

  static List<AppNotification> own(DateTime now) {
    final t = dateOnly(now);
    final aarav = '${DemoData.aarav.firstName} - ${DemoData.aarav.className}';
    return [
      AppNotification(
        id: 'nf_bus',
        category: NotificationCategory.transit,
        title: 'Bus #14 departed campus',
        summary:
            'ETA at Sector 14 stop is ${fmtClock(now.add(const Duration(minutes: 25)))}',
        body:
            'Bus #14 left the school campus with ${DemoData.aarav.firstName} on board. '
            'Expected arrival at the Sector 14 stop is ${fmtClock(now.add(const Duration(minutes: 25)))}. '
            'Please be at the stop five minutes early.',
        time: now.subtract(const Duration(minutes: 12)),
        from: 'Transport desk',
        childLabel: aarav,
        reference: 'TRN-BUS14-${t.day}${t.month}',
        actionLabel: 'Track live bus',
        actionRoute: RoutePaths.trackLive,
      ),
      AppNotification(
        id: 'nf_exam',
        category: NotificationCategory.academic,
        title: 'Term 2 Math pre-board schedule released',
        summary: 'Exams run for two weeks, 09:00 AM - 12:00 PM daily.',
        body:
            'The official pre-board timetable and examination guidelines have been released. '
            'Preparatory leave begins on ${fmtDate(plusDays(14, from: t), year: true)}.\n\n'
            'Examinations run from ${fmtShort(plusDays(20, from: t))} to ${fmtShort(plusDays(34, from: t))} '
            'between 09:00 AM and 12:00 PM daily. Seating is in Hall 3, Floor 2, and reporting time for all students is 08:30 AM.',
        time: now.subtract(const Duration(hours: 1)),
        from: 'Office of the Controller of Examinations',
        childLabel: aarav,
        reference: 'CIR-EX-${t.year}-102',
        actionLabel: 'Open timetable',
        actionRoute: RoutePaths.academicsSection('timetable'),
      ),
      AppNotification(
        id: 'nf_fee',
        category: NotificationCategory.fees,
        title: 'Q3 tuition fee invoice ready',
        summary: '${inr(14500)} due on ${fmtShort(plusDays(5, from: t))}',
        body:
            'The Q3 tuition fee invoice of ${inr(14500)} is ready. Please pay by ${fmtDate(plusDays(5, from: t), year: true)} '
            'to avoid a late fee. The receipt is available in the Fees tab after payment.',
        time: plusDays(-1, from: t).add(const Duration(hours: 16, minutes: 30)),
        from: 'Accounts office',
        childLabel: aarav,
        reference: 'INV-Q3-${t.year}-0142',
        actionLabel: 'View fees',
        actionRoute: RoutePaths.fees,
        read: true,
      ),
      AppNotification(
        id: 'nf_merit',
        category: NotificationCategory.merit,
        title: 'Academic Leadership Star awarded',
        summary: 'Awarded for peer guidance in Mathematics',
        body:
            '${DemoData.aarav.firstName} received the Academic Leadership Star for helping classmates '
            'prepare for the Mathematics unit test. Well done!',
        time: plusDays(-1, from: t).add(const Duration(hours: 11, minutes: 20)),
        from: DemoData.aarav.classTeacher,
        childLabel: aarav,
        actionLabel: 'View behaviour',
        actionRoute: RoutePaths.behaviour,
        read: true,
      ),
      AppNotification(
        id: 'nf_rain',
        category: NotificationCategory.emergency,
        title: 'Heavy rain advisory: early dismissal',
        summary: 'School closes at 12:30 PM. Buses leave at 12:45 PM.',
        body:
            'Due to the heavy rain warning, school will close at 12:30 PM. All buses leave at 12:45 PM. '
            'Parents picking up their children should reach the main gate by 12:30 PM.',
        time: plusDays(-2, from: t).add(const Duration(hours: 7, minutes: 45)),
        from: 'Principal\'s office',
        reference: 'EMG-${t.year}-07',
        actionLabel: 'Message the school',
        actionRoute: RoutePaths.messages,
      ),
    ];
  }

  /// School notices, shown as notifications. Notices older than a day start as read.
  static AppNotification fromNotice(Notice n, DateTime now) => AppNotification(
    id: 'notice_${n.id}',
    noticeId: n.id,
    category: switch (n.category) {
      NoticeCategory.exam => NotificationCategory.academic,
      NoticeCategory.urgent => NotificationCategory.emergency,
      _ => NotificationCategory.notice,
    },
    title: n.title,
    summary: n.from,
    body: n.body,
    time: dateOnly(n.date).add(const Duration(hours: 7, minutes: 30)),
    from: n.from,
    requiresAck: n.requiresAck,
    acknowledged: n.acknowledged,
    read: dateOnly(now).difference(dateOnly(n.date)).inDays >= 1,
  );
}
