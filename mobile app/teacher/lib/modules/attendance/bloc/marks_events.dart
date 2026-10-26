import 'package:equatable/equatable.dart';
import '../models/marks_models.dart';

sealed class MarksEvent extends Equatable {
  const MarksEvent();
  @override
  List<Object?> get props => [];
}

class MarksLoadRequested extends MarksEvent {
  const MarksLoadRequested({this.examId, this.classId});
  /// Open this exam, or else the first exam of [classId] (the class card's Marks button).
  final String? examId, classId;
  @override
  List<Object?> get props => [examId, classId];
}

class MarksExamSelected extends MarksEvent {
  const MarksExamSelected(this.examId);
  final String examId;
  @override
  List<Object?> get props => [examId];
}

/// Filter: All | Pending | Graded | Absent.
class MarksFilterChanged extends MarksEvent {
  const MarksFilterChanged(this.filter);
  final String filter;
  @override
  List<Object?> get props => [filter];
}

class MarksQueryChanged extends MarksEvent {
  const MarksQueryChanged(this.query);
  final String query;
  @override
  List<Object?> get props => [query];
}

/// Insert or replace one student's mark.
class MarkSaved extends MarksEvent {
  const MarkSaved(this.mark);
  final StudentMark mark;
  @override
  List<Object?> get props => [mark];
}

class MarksExamSubmitted extends MarksEvent {
  const MarksExamSubmitted(this.examId);
  final String examId;
  @override
  List<Object?> get props => [examId];
}

class MarksRefreshed extends MarksEvent {
  const MarksRefreshed();
}
