import 'package:equatable/equatable.dart';

sealed class StudentsEvent extends Equatable {
  const StudentsEvent();
  @override
  List<Object?> get props => [];
}

/// Loads the conduct records used for merits, flags and honors.
class StudentsLoadRequested extends StudentsEvent {
  const StudentsLoadRequested();
}

class StudentsExportRequested extends StudentsEvent {
  const StudentsExportRequested(this.classId, this.count);
  final String classId;
  final int count;
  @override
  List<Object?> get props => [classId, count];
}

/// Logs a call to a guardian of [studentId].
class GuardianCalled extends StudentsEvent {
  const GuardianCalled({required this.studentId, required this.name, required this.phone});
  final String studentId, name, phone;
  @override
  List<Object?> get props => [studentId, name, phone];
}
