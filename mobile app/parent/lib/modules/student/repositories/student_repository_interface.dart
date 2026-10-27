import '../models/certificate_models.dart';
import '../models/student_models.dart';

abstract class IStudentRepository {
  /// Cache-first profile of the child (identity, academics snapshot, medical, guardians, transport, documents).
  Stream<StudentProfile> watchProfile(String childId);

  /// Cache-first certificates (issued and requested). Writes push fresh data through this stream.
  Stream<List<Certificate>> watchCertificates(String childId);

  /// Records a (simulated) download and returns the updated certificate.
  Future<Certificate> recordDownload({
    required String childId,
    required String certificateId,
  });

  /// Asks the school office for a certificate; it shows as "Requested" until issued.
  Future<Certificate> requestCertificate({
    required String childId,
    required CertificateRequestType type,
    required String purpose,
  });
}
