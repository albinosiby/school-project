import 'package:equatable/equatable.dart';
import '../models/lesson_plan_models.dart';

sealed class LessonPlansEvent extends Equatable {
  const LessonPlansEvent();
  @override
  List<Object?> get props => [];
}

class LessonPlansLoadRequested extends LessonPlansEvent {
  const LessonPlansLoadRequested();
}

/// Ticks/unticks milestone [index] of plan [planId].
class LessonMilestoneToggled extends LessonPlansEvent {
  const LessonMilestoneToggled(this.planId, this.index);
  final String planId;
  final int index;
  @override
  List<Object?> get props => [planId, index];
}

class LessonPlanDeleted extends LessonPlansEvent {
  const LessonPlanDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class LessonPlanShared extends LessonPlansEvent {
  const LessonPlanShared(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Creates (empty id) or updates [plan]. [plan.draft] decides the feedback message.
class LessonPlanSaved extends LessonPlansEvent {
  const LessonPlanSaved(this.plan);
  final LessonPlan plan;
  @override
  List<Object?> get props => [plan];
}
