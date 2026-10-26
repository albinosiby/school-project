import '../../../core/bloc/child_data_bloc.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Join tapped: record the link open (the screen launches the Meet link).
class JoinLiveClass extends ChildDataEvent {
  const JoinLiveClass(this.classId);
  final String classId;
  @override
  List<Object?> get props => [classId];
}
