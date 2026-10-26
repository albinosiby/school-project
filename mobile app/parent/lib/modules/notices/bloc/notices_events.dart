import '../../../core/bloc/child_data_bloc.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Guardian confirms they have read the notice.
class AcknowledgeNotice extends ChildDataEvent {
  const AcknowledgeNotice(this.noticeId);
  final String noticeId;
  @override
  List<Object?> get props => [noticeId];
}
