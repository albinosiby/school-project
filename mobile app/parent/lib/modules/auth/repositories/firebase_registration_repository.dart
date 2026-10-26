import '../../../utils/exceptions/app_exception.dart';
import '../models/auth_models.dart';
import 'registration_repository_interface.dart';

/// Parent logins are created by the school (admin web > Students > Parent login, data contract §13.1),
/// so self-registration points the guardian to the school office.
class FirebaseRegistrationRepository implements IRegistrationRepository {
  static AppException get _office => AppException(
        message: 'Parent logins are created by the school. Ask the school office to add your email to your child\'s record; you will get an invite to set your password.',
      );

  @override
  Future<StudentMatch> lookupStudent(String admissionNo, DateTime dob) async => throw _office;

  @override
  Future<PendingRegistration> submit(RegistrationRequest request) async => throw _office;
}
