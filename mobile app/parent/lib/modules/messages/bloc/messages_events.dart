import '../../../core/bloc/child_data_bloc.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

class PinThread extends ChildDataEvent {
  const PinThread(this.threadId, {required this.pinned});
  final String threadId;
  final bool pinned;
  @override
  List<Object?> get props => [threadId, pinned];
}

class MarkThreadRead extends ChildDataEvent {
  const MarkThreadRead(this.threadId);
  final String threadId;
  @override
  List<Object?> get props => [threadId];
}

class MarkAllThreadsRead extends ChildDataEvent {
  const MarkAllThreadsRead();
}

class DeleteDraft extends ChildDataEvent {
  const DeleteDraft(this.draftId);
  final String draftId;
  @override
  List<Object?> get props => [draftId];
}
