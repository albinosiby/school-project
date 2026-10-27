import '../models/auth_models.dart';

/// New parent registration (Onboarding 1.1).
abstract class IRegistrationRepository {
  /// Finds the student by admission / scholar number and date of birth. Throws [AppException] when nothing matches.
  Future<StudentMatch> lookupStudent(String admissionNo, DateTime dob);

  /// Creates a pending registration for the school office to verify.
  Future<PendingRegistration> submit(RegistrationRequest request);
}
