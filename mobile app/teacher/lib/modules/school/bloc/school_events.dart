import 'package:equatable/equatable.dart';
import '../models/school_models.dart';

sealed class SchoolEvent extends Equatable {
  const SchoolEvent();
  @override
  List<Object?> get props => [];
}

/// Load (or reload) teacher, classes and students.
class SchoolLoadRequested extends SchoolEvent {
  const SchoolLoadRequested();
}

class TeacherUpdated extends SchoolEvent {
  const TeacherUpdated(this.teacher);
  final Teacher teacher;
  @override
  List<Object?> get props => [teacher];
}
