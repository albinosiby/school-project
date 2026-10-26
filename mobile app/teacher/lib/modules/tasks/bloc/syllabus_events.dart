import 'package:equatable/equatable.dart';

sealed class SyllabusEvent extends Equatable {
  const SyllabusEvent();
  @override
  List<Object?> get props => [];
}

class SyllabusLoadRequested extends SyllabusEvent {
  const SyllabusLoadRequested();
}

/// Logs one taught period for a topic of a division.
class SyllabusPeriodLogged extends SyllabusEvent {
  const SyllabusPeriodLogged(this.divisionId, this.topicIndex);
  final String divisionId;
  final int topicIndex;
  @override
  List<Object?> get props => [divisionId, topicIndex];
}

/// Submits the log to the VP, or withdraws the submission.
class SyllabusSubmissionToggled extends SyllabusEvent {
  const SyllabusSubmissionToggled();
}
