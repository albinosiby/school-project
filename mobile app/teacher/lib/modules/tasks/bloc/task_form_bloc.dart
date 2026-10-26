import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/task_repository_interface.dart';
import 'task_form_events.dart';
import 'task_form_states.dart';

/// Add / edit task or reminder (`RoutePaths.taskAdd`, `?id=` to edit).
class TaskFormBloc extends Bloc<TaskFormEvent, TaskFormState> {
  TaskFormBloc(this._tasks, this._school) : super(const TaskFormState()) {
    on<TaskFormLoadRequested>(_onLoad);
    on<TaskFormSubmitted>(_onSubmit);
  }

  final ITaskRepository _tasks;
  final ISchoolRepository _school;

  Future<void> _onLoad(TaskFormLoadRequested e, Emitter<TaskFormState> emit) async {
    emit(state.copyWith(status: TaskFormStatus.loading, editId: e.editId));
    try {
      final id = e.editId;
      emit(state.copyWith(
        status: TaskFormStatus.ready,
        task: id == null ? null : await _tasks.get(id),
        classes: await _school.getClasses(),
        term: (await _school.getTeacher()).term,
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: TaskFormStatus.failure, error: err.message));
    }
  }

  Future<void> _onSubmit(TaskFormSubmitted e, Emitter<TaskFormState> emit) async {
    emit(state.copyWith(status: TaskFormStatus.saving));
    try {
      final existing = state.task;
      if (existing != null) {
        await _tasks.update(existing.copyWith(
          title: e.draft.title, kind: e.draft.kind, category: e.draft.category, priority: e.draft.priority, classId: e.draft.classId,
          due: e.draft.due, notify: e.draft.notify, notes: e.draft.notes,
        ));
      } else {
        await _tasks.create(e.draft);
      }
      emit(state.copyWith(status: TaskFormStatus.saved, savedReminder: e.draft.isReminder));
    } on AppException catch (err) {
      emit(state.copyWith(status: TaskFormStatus.failure, error: err.message));
    }
  }
}
