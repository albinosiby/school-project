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

/// Closes an open homework (no more hand-ins), or reopens a closed one.
class HomeworkStatusToggled extends HomeworkEvent {
  const HomeworkStatusToggled();
}

/// The teacher records a paper hand-in ([handedIn] true) or undoes it (back to pending).
class HomeworkSubmissionMarked extends HomeworkEvent {
  const HomeworkSubmissionMarked(this.studentId, {this.handedIn = true});
  final String studentId;
  final bool handedIn;
  @override
  List<Object?> get props => [studentId, handedIn];
}

/// Every student still pending is marked as handed in on paper.
class HomeworkAllMarkedIn extends HomeworkEvent {
  const HomeworkAllMarkedIn();
}

/// Grades one student: [marks] out of the homework's max (null for a not-graded homework = "done"), and feedback.
class HomeworkGradeSaved extends HomeworkEvent {
  const HomeworkGradeSaved({required this.studentId, this.marks, this.feedback = ''});
  final String studentId;
  final num? marks;
  final String feedback;
  @override
  List<Object?> get props => [studentId, marks, feedback];
}

/// Soft-deletes the homework (parents' copies are removed by the server).
class HomeworkDeleted extends HomeworkEvent {
  const HomeworkDeleted();
}
