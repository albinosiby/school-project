import 'package:equatable/equatable.dart';
import '../models/auth_models.dart';

enum LookupStatus { idle, looking, failed }

enum SubmitStatus { idle, submitting, failed, submitted }

class RegistrationState extends Equatable {
  const RegistrationState({
    this.students = const [],
    this.lookup = LookupStatus.idle,
    this.lookupError,
    this.submit = SubmitStatus.idle,
    this.submitError,
    this.result,
  });

  /// Verified student matches, in the order they were added.
  final List<StudentMatch> students;
  final LookupStatus lookup;
  final String? lookupError;
  final SubmitStatus submit;
  final String? submitError;
  final PendingRegistration? result;

  RegistrationState copyWith({
    List<StudentMatch>? students,
    LookupStatus? lookup,
    String? lookupError,
    SubmitStatus? submit,
    String? submitError,
    PendingRegistration? result,
  }) => RegistrationState(
    students: students ?? this.students,
    lookup: lookup ?? this.lookup,
    lookupError: lookupError,
    submit: submit ?? this.submit,
    submitError: submitError,
    result: result ?? this.result,
  );

  @override
  List<Object?> get props => [
    students,
    lookup,
    lookupError,
    submit,
    submitError,
    result,
  ];
}
