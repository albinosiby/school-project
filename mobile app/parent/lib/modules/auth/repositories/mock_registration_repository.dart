import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/auth_models.dart';
import 'auth_demo_data.dart';
import 'registration_repository_interface.dart';

/// Looks students up in [AuthDemoData.admissionRecords]; registrations are kept in memory.
class MockRegistrationRepository implements IRegistrationRepository {
  MockRegistrationRepository({DateTime Function()? clock})
    : _now = clock ?? DateTime.now;
  final DateTime Function() _now;
  final List<PendingRegistration> _pending = [];

  /// Registrations submitted in this session (newest last).
  List<PendingRegistration> get pending => List.unmodifiable(_pending);

  @override
  Future<StudentMatch> lookupStudent(String admissionNo, DateTime dob) async {
    await MockLatency.wait();
    final no = StudentMatch.normalise(admissionNo);
    final match = AuthDemoData.admissionRecords
        .where((r) => r.admissionNo == no)
        .firstOrNull;
    if (match == null) {
      throw AppException(
        message: 'No admission record found for $no.',
        statusCode: 404,
      );
    }
    if (dateOnly(match.dob) != dateOnly(dob)) {
      throw AppException(
        message: 'Date of birth does not match the admission record.',
      );
    }
    return match;
  }

  @override
  Future<PendingRegistration> submit(RegistrationRequest request) async {
    await MockLatency.wait();
    if (request.students.isEmpty) {
      throw AppException(message: 'Verify at least one student.');
    }
    if (request.phone.replaceAll(RegExp(r'\D'), '').length != 10) {
      throw AppException(message: 'Enter a valid 10-digit mobile number.');
    }
    final now = _now();
    final reg = PendingRegistration(
      reference:
          'REG-${now.year}-${(4200 + _pending.length + 1).toString().padLeft(4, '0')}',
      request: request,
      submittedAt: now,
    );
    _pending.add(reg);
    return reg;
  }
}
