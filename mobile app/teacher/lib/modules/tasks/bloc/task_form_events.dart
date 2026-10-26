import 'package:equatable/equatable.dart';
import '../models/task_models.dart';

sealed class TaskFormEvent extends Equatable {
  const TaskFormEvent();
  @override
  List<Object?> get props => [];
}

/// Loads classes (and the task when [editId] is set).
class TaskFormLoadRequested extends TaskFormEvent {
  const TaskFormLoadRequested({this.editId});
  final String? editId;
  @override
  List<Object?> get props => [editId];
}

/// Creates the task, or saves the edited fields of the loaded task.
class TaskFormSubmitted extends TaskFormEvent {
  const TaskFormSubmitted(this.draft);
  final TaskItem draft;
  @override
  List<Object?> get props => [draft];
}
