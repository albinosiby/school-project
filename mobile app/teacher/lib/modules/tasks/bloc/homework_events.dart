import 'package:equatable/equatable.dart';

sealed class HomeworkEvent extends Equatable {
  const HomeworkEvent();
  @override
  List<Object?> get props => [];
}

/// Loads homework [id] with its class roster.
class HomeworkLoadRequested extends HomeworkEvent {
  const HomeworkLoadRequested(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Closes an open homework, or reopens a closed one.
class HomeworkStatusToggled extends HomeworkEvent {
  const HomeworkStatusToggled();
}

/// Records that a student handed in their paper.
class HomeworkSubmissionMarked extends HomeworkEvent {
  const HomeworkSubmissionMarked(this.studentId);
  final String studentId;
  @override
  List<Object?> get props => [studentId];
}

/// Saves rubric marks for one student. [rationale] is required when re-grading.
class HomeworkGradeSaved extends HomeworkEvent {
  const HomeworkGradeSaved({required this.studentId, required this.criteria, required this.feedback, this.rationale});
  final String studentId;
  final List<int> criteria;
  final String feedback;
  final String? rationale;
  @override
  List<Object?> get props => [studentId, criteria, feedback, rationale];
}
