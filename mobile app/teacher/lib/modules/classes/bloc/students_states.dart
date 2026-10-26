import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

enum StudentsStatus { initial, loading, loaded, failure }

class StudentsState extends Equatable {
  const StudentsState({this.status = StudentsStatus.initial, this.logs = const [], this.notice, this.noticeSeq = 0, this.error});
  final StudentsStatus status;
  final List<BehaviourLog> logs;
  final String? notice;
  final int noticeSeq;
  final String? error;

  StudentsState copyWith({StudentsStatus? status, List<BehaviourLog>? logs, String? notice, bool bumpNotice = false, String? error}) => StudentsState(
        status: status ?? this.status, logs: logs ?? this.logs, notice: bumpNotice ? notice : this.notice, noticeSeq: bumpNotice ? noticeSeq + 1 : noticeSeq, error: error,
      );

  @override
  List<Object?> get props => [status, logs, notice, noticeSeq, error];
}
