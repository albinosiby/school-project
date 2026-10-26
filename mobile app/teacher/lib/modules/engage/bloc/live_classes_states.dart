import 'package:equatable/equatable.dart';
import '../models/live_class_models.dart';
import 'engage_notice.dart';

class LiveClassesState extends Equatable implements NoticeState {
  const LiveClassesState({this.status = EngageStatus.initial, this.sessions = const [], this.notice, this.error, this.meetBusy = false, this.meeting});
  final EngageStatus status;
  /// A Google Meet room is being created.
  final bool meetBusy;
  /// The last Meet room created from the form (the form copies its link).
  final GoogleMeeting? meeting;
  final List<LiveSession> sessions;
  @override
  final Notice? notice;
  final String? error;

  /// Live, upcoming and draft sessions, soonest first.
  List<LiveSession> get upcoming => sessions.where((e) => !e.isPast).toList()..sort((a, b) => a.sortKey.compareTo(b.sortKey));

  /// Past recordings, newest first.
  List<LiveSession> get past => sessions.where((e) => e.isPast).toList()..sort((a, b) => b.sortKey.compareTo(a.sortKey));

  LiveSession? byId(String id) => sessions.where((e) => e.id == id).firstOrNull;

  LiveClassesState copyWith({EngageStatus? status, List<LiveSession>? sessions, Notice? notice, String? error, bool? meetBusy, GoogleMeeting? meeting}) => LiveClassesState(
        status: status ?? this.status, sessions: sessions ?? this.sessions, notice: notice ?? this.notice, error: error,
        meetBusy: meetBusy ?? this.meetBusy, meeting: meeting ?? this.meeting,
      );

  @override
  List<Object?> get props => [status, sessions, notice, error, meetBusy, meeting];
}
