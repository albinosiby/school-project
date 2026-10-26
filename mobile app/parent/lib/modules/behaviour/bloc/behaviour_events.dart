import '../../../core/bloc/child_data_bloc.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Guardian acknowledges a guidance entry (incident), optionally replying to the teacher.
class AcknowledgeConduct extends ChildDataEvent {
  const AcknowledgeConduct(this.entryId, {this.note});
  final String entryId;
  final String? note;
  @override
  List<Object?> get props => [entryId, note];
}
