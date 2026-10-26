import 'package:equatable/equatable.dart';
import '../../../constants/app_constants.dart';

enum LiveStatus { upcoming, live, ended }

class LiveClass extends Equatable {
  const LiveClass({
    required this.id,
    required this.title,
    required this.subject,
    required this.teacher,
    required this.start,
    required this.mins,
    required this.link,
  });
  final String id, title, subject, teacher, link;
  final DateTime start;
  final int mins;

  /// Join opens 10 minutes before the start (DATA_CONTRACT section 6).
  DateTime get opensAt => start.subtract(AppConstants.joinLeadTime);
  DateTime get endsAt => start.add(Duration(minutes: mins));

  /// Status is derived from the clock.
  LiveStatus statusAt(DateTime now) {
    if (!now.isBefore(endsAt)) return LiveStatus.ended;
    if (!now.isBefore(start)) return LiveStatus.live;
    return LiveStatus.upcoming;
  }

  /// Enabled from 10 min before the start until start + mins.
  bool canJoinAt(DateTime now) =>
      !now.isBefore(opensAt) && now.isBefore(endsAt);

  @override
  List<Object?> get props => [id, title, subject, teacher, link, start, mins];
}
