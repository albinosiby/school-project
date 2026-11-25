import '../../../core/bloc/child_data_bloc.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// The guardian opened a notice (counts as read for the school).
class NoticeOpened extends ChildDataEvent {
  const NoticeOpened(this.noticeId);
  final String noticeId;
  @override
  List<Object?> get props => [noticeId];
}

/// Guardian confirms they have read the notice.
class AcknowledgeNotice extends ChildDataEvent {
  const AcknowledgeNotice(this.noticeId);
  final String noticeId;
  @override
  List<Object?> get props => [noticeId];
}
