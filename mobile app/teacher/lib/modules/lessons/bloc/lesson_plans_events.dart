import 'package:equatable/equatable.dart';
import '../../engage/screens/widgets/attachment_sheet.dart';
import '../models/lesson_plan_models.dart';

sealed class LessonPlansEvent extends Equatable {
  const LessonPlansEvent();
  @override
  List<Object?> get props => [];
}

class LessonPlansLoadRequested extends LessonPlansEvent {
  const LessonPlansLoadRequested();
}

/// A session was taught (with an optional note on how it went), skipped, or reopened.
class LessonSessionMarked extends LessonPlansEvent {
  const LessonSessionMarked(this.planId, this.sessionId, this.status, {this.note});
  final String planId, sessionId;
  final SessionStatus status;
  final String? note;
  @override
  List<Object?> get props => [planId, sessionId, status, note];
}

class LessonPlanDeleted extends LessonPlansEvent {
  const LessonPlanDeleted(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Creates (empty id) or updates [plan]; [files] are uploaded first and added to its attachments.
class LessonPlanSaved extends LessonPlansEvent {
  const LessonPlanSaved(this.plan, {this.files = const []});
  final LessonPlan plan;
  final List<PickedAttachment> files;
  @override
  List<Object?> get props => [plan, files];
}

/// Copies a plan to another section of the same subject (as a draft, with dates from that class's timetable).
class LessonPlanCopied extends LessonPlansEvent {
  const LessonPlanCopied(this.planId, {required this.cls, this.classId = ''});
  final String planId, cls, classId;
  @override
  List<Object?> get props => [planId, cls, classId];
}

/// Sends the plan to the HOD / admin for review.
class LessonPlanReviewRequested extends LessonPlansEvent {
  const LessonPlanReviewRequested(this.planId);
  final String planId;
  @override
  List<Object?> get props => [planId];
}
