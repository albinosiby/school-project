import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

enum BehaviourStatus { initial, loading, loaded, failure }

class BehaviourState extends Equatable {
  const BehaviourState({this.status = BehaviourStatus.initial, this.logs = const [], this.badges = const [], this.notice, this.noticeSeq = 0, this.savedSeq = 0, this.error});
  final BehaviourStatus status;
  final List<BehaviourLog> logs;
  final List<BehaviourBadge> badges;
  /// One-off feedback message; listeners react when [noticeSeq] changes.
  final String? notice;
  final int noticeSeq;
  /// Incremented after a log is published (the New Log screen closes on it).
  final int savedSeq;
  final String? error;

  BehaviourState copyWith({BehaviourStatus? status, List<BehaviourLog>? logs, List<BehaviourBadge>? badges, String? notice, bool bumpNotice = false, bool saved = false, String? error}) => BehaviourState(
        status: status ?? this.status, logs: logs ?? this.logs, badges: badges ?? this.badges,
        notice: bumpNotice ? notice : this.notice, noticeSeq: bumpNotice ? noticeSeq + 1 : noticeSeq, savedSeq: saved ? savedSeq + 1 : savedSeq, error: error,
      );

  @override
  List<Object?> get props => [status, logs, badges, notice, noticeSeq, savedSeq, error];
}
