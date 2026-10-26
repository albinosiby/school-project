import 'package:equatable/equatable.dart';

sealed class TasksEvent extends Equatable {
  const TasksEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or reload) tasks, open homework and classes.
class TasksLoadRequested extends TasksEvent {
  const TasksLoadRequested();
}

/// Marks a task done, or reopens it when it is done.
class TaskDoneToggled extends TasksEvent {
  const TaskDoneToggled(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class TaskDeleted extends TasksEvent {
  const TaskDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Simulated parent call (`call`) or message (`message`) on a follow-up task.
class TaskContactRecorded extends TasksEvent {
  const TaskContactRecorded(this.id, this.kind);
  final String id, kind;
  @override
  List<Object?> get props => [id, kind];
}

/// Saves how many papers of a grading task have been reviewed.
class TaskReviewSaved extends TasksEvent {
  const TaskReviewSaved(this.id, this.reviewed);
  final String id;
  final int reviewed;
  @override
  List<Object?> get props => [id, reviewed];
}
