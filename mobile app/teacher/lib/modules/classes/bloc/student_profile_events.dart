import 'package:equatable/equatable.dart';
import '../models/student_details.dart';

sealed class StudentProfileEvent extends Equatable {
  const StudentProfileEvent();
  @override
  List<Object?> get props => [];
}

/// Loads the record of [studentId] in [classId]; [details] also loads the admission record (class teacher only).
class StudentProfileLoadRequested extends StudentProfileEvent {
  const StudentProfileLoadRequested(this.studentId, this.classId, {this.details = false});
  final String studentId, classId;
  final bool details;
  @override
  List<Object?> get props => [studentId, classId, details];
}

class StudentProfileRefreshed extends StudentProfileEvent {
  const StudentProfileRefreshed();
}

/// Retries loading the admission record after an error.
class StudentDetailsRetried extends StudentProfileEvent {
  const StudentDetailsRetried();
}

/// The class teacher saved a correction (contacts, address or medical).
class StudentDetailsSaved extends StudentProfileEvent {
  const StudentDetailsSaved(this.patch);
  final StudentDetailsPatch patch;
  @override
  List<Object?> get props => [identityHashCode(patch)];
}
