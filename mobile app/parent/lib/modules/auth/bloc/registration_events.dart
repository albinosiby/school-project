import 'package:equatable/equatable.dart';

sealed class RegistrationEvent extends Equatable {
  const RegistrationEvent();
  @override
  List<Object?> get props => [];
}

/// "Verify Student" / "Add Student": look the admission number + date of birth up and add the match.
class StudentLookupRequested extends RegistrationEvent {
  const StudentLookupRequested(this.admissionNo, this.dob);
  final String admissionNo;
  final DateTime dob;
  @override
  List<Object?> get props => [admissionNo, dob];
}

class StudentRemoved extends RegistrationEvent {
  const StudentRemoved(this.admissionNo);
  final String admissionNo;
  @override
  List<Object?> get props => [admissionNo];
}

class RegistrationSubmitted extends RegistrationEvent {
  const RegistrationSubmitted({
    required this.guardianName,
    required this.relation,
    required this.phone,
  });
  final String guardianName, relation, phone;
  @override
  List<Object?> get props => [guardianName, relation, phone];
}
