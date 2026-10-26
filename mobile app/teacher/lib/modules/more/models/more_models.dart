import 'package:equatable/equatable.dart';

/// Read-only counts shown on the More hub (Teaching Pulse + module badges).
class MoreSummary extends Equatable {
  const MoreSummary({this.activePlans = 0, this.draftPlans = 0, this.upcomingTests = 0, this.pendingCertificates = 0, this.openTasks = 0, this.unreadMessages = 0,
      this.todayClasses = 0, this.nextClass = '', this.leaveBadge = '', this.meetingBadge = '', this.dutyBadge = '', this.nextLive = ''});
  final int activePlans, draftPlans, upcomingTests, pendingCertificates, openTasks, unreadMessages, todayClasses;
  final String nextClass, leaveBadge, meetingBadge, dutyBadge, nextLive;

  factory MoreSummary.fromJson(Map<String, dynamic> j) {
    int i(String k) => (j[k] as num?)?.toInt() ?? 0;
    return MoreSummary(
      activePlans: i('activePlans'), draftPlans: i('draftPlans'), upcomingTests: i('upcomingTests'),
      pendingCertificates: i('pendingCertificates'), openTasks: i('openTasks'), unreadMessages: i('unreadMessages'),
      todayClasses: i('todayClasses'), nextClass: '${j['nextClass'] ?? ''}', leaveBadge: '${j['leaveBadge'] ?? ''}',
      meetingBadge: '${j['meetingBadge'] ?? ''}', dutyBadge: '${j['dutyBadge'] ?? ''}', nextLive: '${j['nextLive'] ?? ''}',
    );
  }
  Map<String, dynamic> toJson() => {
        'activePlans': activePlans, 'draftPlans': draftPlans, 'upcomingTests': upcomingTests,
        'pendingCertificates': pendingCertificates, 'openTasks': openTasks, 'unreadMessages': unreadMessages,
        'todayClasses': todayClasses, 'nextClass': nextClass, 'leaveBadge': leaveBadge, 'meetingBadge': meetingBadge, 'dutyBadge': dutyBadge, 'nextLive': nextLive,
      };
  MoreSummary copyWith({int? openTasks, int? unreadMessages}) =>
      MoreSummary.fromJson({...toJson(), 'openTasks': ?openTasks, 'unreadMessages': ?unreadMessages});

  @override
  List<Object?> get props => [activePlans, draftPlans, upcomingTests, pendingCertificates, openTasks, unreadMessages, todayClasses, nextClass, leaveBadge, meetingBadge, dutyBadge, nextLive];
}
