import 'package:equatable/equatable.dart';
import '../../school/models/school_models.dart';
import '../models/homework_grading.dart';
import '../models/homework_models.dart';

enum AssignmentsStatus { initial, loading, loaded, failure }

/// One assignment with its class and hand-in figures.
class AssignmentItem {
  AssignmentItem(this.hw, this.cls, this.stats);
  final Homework hw;
  final SchoolClass? cls;
  final HomeworkStats stats;

  String get classLabel => cls == null ? 'Class' : 'Class ${cls!.label}';

  /// Hidden from parents until published.
  bool get upcoming => hw.scheduled || hw.status == 'draft';
  bool get closed => hw.status == 'closed';
  bool get active => !upcoming && !closed;
  int? daysLeft(DateTime today) => hw.daysLeft(today);
}

class AssignmentsState extends Equatable {
  const AssignmentsState({this.status = AssignmentsStatus.initial, this.homework = const [], this.classes = const [], this.students = const [], this.error});
  final AssignmentsStatus status;
  final List<Homework> homework;
  final List<SchoolClass> classes;
  final List<Student> students;
  final String? error;

  List<AssignmentItem> get items {
    final out = [
      for (final h in homework)
        if (h.extra['deleted'] != true) AssignmentItem(h, classes.where((c) => c.id == h.classId).firstOrNull, HomeworkStats.of(h, students)),
    ];
    out.sort((a, b) => a.hw.due.compareTo(b.hw.due));
    return out;
  }

  /// Classes that have at least one assignment, in class order.
  List<SchoolClass> get usedClasses {
    final ids = {for (final h in homework) h.classId};
    return [for (final c in classes) if (ids.contains(c.id)) c];
  }

  AssignmentsState copyWith({AssignmentsStatus? status, List<Homework>? homework, List<SchoolClass>? classes, List<Student>? students, String? error}) => AssignmentsState(
    status: status ?? this.status,
    homework: homework ?? this.homework,
    classes: classes ?? this.classes,
    students: students ?? this.students,
    error: error,
  );

  @override
  List<Object?> get props => [status, homework, classes, students, error];
}
