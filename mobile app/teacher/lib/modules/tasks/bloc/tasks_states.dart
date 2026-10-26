import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/homework_models.dart';
import '../models/task_models.dart';
import '../models/tasks_format.dart';

enum TasksStatus { initial, loading, loaded, failure }

class TasksState extends Equatable {
  const TasksState({this.status = TasksStatus.initial, this.tasks = const [], this.homework = const [], this.classes = const [], this.teacher, this.error});
  final TasksStatus status;
  final List<TaskItem> tasks;
  final List<Homework> homework;
  final List<SchoolClass> classes;
  final Teacher? teacher;
  final String? error;

  /// Open tasks sorted by due date (undated last).
  List<TaskItem> get open => [for (final t in tasks) if (!t.isDone) t]
    ..sort((a, b) => (a.dueAt ?? DateTime(2100)).compareTo(b.dueAt ?? DateTime(2100)));
  List<TaskItem> get done => [for (final t in tasks) if (t.isDone) t];
  List<TaskItem> get dueToday => open.where((t) => t.isDueToday).toList();
  List<TaskItem> openIn(String category) => open.where((t) => t.category == category).toList();

  /// Tasks due (or completed) in the 7 days starting today.
  List<TaskItem> get weekTasks {
    final today = dayOf(DateTime.now());
    bool inWeek(DateTime? d) => d != null && !dayOf(d).isBefore(today) && dayOf(d).isBefore(today.add(const Duration(days: 7)));
    return [for (final t in tasks) if (inWeek(parseDt(t.isDone ? t.doneAt : t.due))) t];
  }

  int get weekDone => weekTasks.where((t) => t.isDone).length;
  int get weekPct => weekTasks.isEmpty ? 0 : (weekDone * 100 / weekTasks.length).round();

  /// Submitted-but-ungraded papers across open homework, and the class with the most of them.
  (int, String?) get toGrade {
    var total = 0, best = 0;
    String? cls;
    for (final h in homework) {
      if (h.status == 'closed') continue;
      final n = h.count(SubmissionStatus.submitted);
      total += n;
      if (n > best) {
        best = n;
        cls = classById(h.classId)?.label;
      }
    }
    return (total, cls);
  }

  SchoolClass? classById(String id) => classes.where((c) => c.id == id).firstOrNull;

  /// "Class 10-B", or "General" when the task has no class.
  String classLabel(String? id) {
    final c = id == null || id.isEmpty ? null : classById(id);
    return c == null ? 'General' : 'Class ${c.label}';
  }

  Homework? homeworkById(String id) => homework.where((h) => h.id == id).firstOrNull;

  TasksState copyWith({TasksStatus? status, List<TaskItem>? tasks, List<Homework>? homework, List<SchoolClass>? classes, Teacher? teacher, String? error}) => TasksState(
        status: status ?? this.status, tasks: tasks ?? this.tasks, homework: homework ?? this.homework, classes: classes ?? this.classes,
        teacher: teacher ?? this.teacher, error: error,
      );

  @override
  List<Object?> get props => [status, tasks, homework, classes, teacher, error];
}
