import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/homework_repository_interface.dart';
import '../repositories/task_repository_interface.dart';
import 'tasks_events.dart';
import 'tasks_states.dart';

/// Tasks tab: tasks & reminders, grading counts from homework. Reloads when tasks, homework or classes change.
class TasksBloc extends Bloc<TasksEvent, TasksState> {
  TasksBloc(this._tasks, this._homework, this._school) : super(const TasksState()) {
    on<TasksLoadRequested>(_onLoad);
    on<TaskDoneToggled>(_onToggle);
    on<TaskDeleted>((e, _) => _tasks.delete(e.id));
    on<TaskContactRecorded>((e, _) => _tasks.recordContact(e.id, e.kind));
    on<TaskReviewSaved>((e, _) => _tasks.saveReview(e.id, e.reviewed));
    _subs = [
      for (final s in [_tasks.watch(), _homework.watch(), _school.watch()]) s.listen((_) => add(const TasksLoadRequested())),
    ];
  }

  final ITaskRepository _tasks;
  final IHomeworkRepository _homework;
  final ISchoolRepository _school;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(TasksLoadRequested e, Emitter<TasksState> emit) async {
    if (state.status == TasksStatus.initial) emit(state.copyWith(status: TasksStatus.loading));
    try {
      emit(state.copyWith(
        status: TasksStatus.loaded,
        tasks: await _tasks.getAll(),
        homework: await _homework.getAll(),
        classes: await _school.getClasses(),
        teacher: await _school.getTeacher(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: TasksStatus.failure, error: err.message));
    }
  }

  Future<void> _onToggle(TaskDoneToggled e, Emitter<TasksState> emit) async {
    final t = state.tasks.where((x) => x.id == e.id).firstOrNull ?? await _tasks.get(e.id);
    if (t != null) await _tasks.setDone(e.id, !t.isDone);
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
