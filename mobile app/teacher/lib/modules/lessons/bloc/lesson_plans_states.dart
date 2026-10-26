import 'package:equatable/equatable.dart';
import '../models/lesson_plan_models.dart';
import 'lessons_notice.dart';

enum LessonPlansStatus { initial, loading, loaded, failure }

class LessonPlansState extends Equatable {
  const LessonPlansState({this.status = LessonPlansStatus.initial, this.plans = const [], this.notice, this.error});
  final LessonPlansStatus status;
  final List<LessonPlan> plans;
  final Notice? notice;
  final String? error;

  LessonPlan? byId(String id) => plans.where((p) => p.id == id).firstOrNull;
  int get activeCount => plans.where((p) => p.isActive).length;
  int get draftCount => plans.where((p) => p.draft).length;

  LessonPlansState copyWith({LessonPlansStatus? status, List<LessonPlan>? plans, Notice? notice, String? error}) =>
      LessonPlansState(status: status ?? this.status, plans: plans ?? this.plans, notice: notice ?? this.notice, error: error);

  @override
  List<Object?> get props => [status, plans, notice, error];
}
