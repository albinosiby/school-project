import 'package:equatable/equatable.dart';
import '../../tasks/models/homework_models.dart';
import '../models/classes_models.dart';

enum ClassesStatus { initial, loading, loaded, failure }

class ClassesState extends Equatable {
  const ClassesState({this.status = ClassesStatus.initial, this.pacing = const {}, this.homework = const [], this.logs = const [], this.resources = const [], this.error});
  final ClassesStatus status;
  final Map<String, ClassPacing> pacing;
  final List<Homework> homework;
  final List<BehaviourLog> logs;
  final List<SharedResource> resources;
  final String? error;

  /// Open homework of a class, soonest due first.
  List<Homework> openHomework(String classId) => homework.where((h) => h.classId == classId && h.status == 'open').toList()..sort((a, b) => a.due.compareTo(b.due));
  int logCount(String classId, String kind) => logs.where((l) => l.classId == classId && l.kind == kind).length;
  int resourceCount(String classId) => resources.where((r) => r.classId == classId).length;

  /// Overall pacing (% of topics done across all classes).
  int get overallPct {
    final done = pacing.values.fold<int>(0, (a, p) => a + p.done), total = pacing.values.fold<int>(0, (a, p) => a + p.total);
    return total == 0 ? 0 : (done * 100 / total).round();
  }

  ClassesState copyWith({ClassesStatus? status, Map<String, ClassPacing>? pacing, List<Homework>? homework, List<BehaviourLog>? logs, List<SharedResource>? resources, String? error}) => ClassesState(
        status: status ?? this.status, pacing: pacing ?? this.pacing, homework: homework ?? this.homework, logs: logs ?? this.logs, resources: resources ?? this.resources, error: error,
      );

  @override
  List<Object?> get props => [status, pacing, homework, logs, resources, error];
}
