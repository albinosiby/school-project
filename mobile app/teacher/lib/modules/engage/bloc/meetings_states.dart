import 'package:equatable/equatable.dart';
import '../models/meeting_models.dart';
import 'engage_notice.dart';

class MeetingsState extends Equatable implements NoticeState {
  const MeetingsState({this.status = EngageStatus.initial, this.meetings = const [], this.notice, this.error});
  final EngageStatus status;
  final List<Meeting> meetings;
  @override
  final Notice? notice;
  final String? error;

  /// All meetings, soonest first.
  List<Meeting> get all => [...meetings]..sort((a, b) => a.sortKey.compareTo(b.sortKey));
  List<Meeting> get upcoming => all.where((e) => !e.completed).toList();

  /// Completed meetings, most recent first.
  List<Meeting> get completed => all.where((e) => e.completed).toList().reversed.toList();

  Meeting? byId(String id) => meetings.where((e) => e.id == id).firstOrNull;

  MeetingsState copyWith({EngageStatus? status, List<Meeting>? meetings, Notice? notice, String? error}) =>
      MeetingsState(status: status ?? this.status, meetings: meetings ?? this.meetings, notice: notice ?? this.notice, error: error);

  @override
  List<Object?> get props => [status, meetings, notice, error];
}
