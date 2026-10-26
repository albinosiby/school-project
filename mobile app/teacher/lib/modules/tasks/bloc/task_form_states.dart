import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/task_models.dart';

enum TaskFormStatus { initial, loading, ready, saving, saved, failure }

class TaskFormState extends Equatable {
  const TaskFormState({this.status = TaskFormStatus.initial, this.editId, this.task, this.classes = const [], this.term = '', this.savedReminder = false, this.error});
  final TaskFormStatus status;
  final String? editId;
  /// The task being edited (null when creating, or when [editId] was not found).
  final TaskItem? task;
  final List<SchoolClass> classes;
  final String term;
  final bool savedReminder;
  final String? error;

  bool get isEdit => editId != null;

  TaskFormState copyWith({TaskFormStatus? status, String? editId, TaskItem? task, List<SchoolClass>? classes, String? term, bool? savedReminder, String? error}) => TaskFormState(
        status: status ?? this.status, editId: editId ?? this.editId, task: task ?? this.task, classes: classes ?? this.classes, term: term ?? this.term,
        savedReminder: savedReminder ?? this.savedReminder, error: error,
      );

  @override
  List<Object?> get props => [status, editId, task, classes, term, savedReminder, error];
}
