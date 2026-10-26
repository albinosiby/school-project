import 'package:equatable/equatable.dart';

sealed class ClassesEvent extends Equatable {
  const ClassesEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or reload) pacing, homework, behaviour and resource summaries for every class.
class ClassesLoadRequested extends ClassesEvent {
  const ClassesLoadRequested();
}

/// Moves the syllabus pacing of [classId] by [delta] topics (clamped to 0..total).
class PacingChanged extends ClassesEvent {
  const PacingChanged(this.classId, this.delta);
  final String classId;
  final int delta;
  @override
  List<Object?> get props => [classId, delta];
}
