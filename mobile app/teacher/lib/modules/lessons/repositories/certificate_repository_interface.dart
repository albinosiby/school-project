import '../models/certificate_models.dart';

/// Student certificates (`cr_certs`), templates (`cr_templates`), the teacher's own
/// certifications (`cr_mine`) and the certificate being composed (`cr_draft`).
abstract class ICertificateRepository {
  Future<List<StudentCertificate>> getCertificates();
  Future<List<CertTemplate>> getTemplates();
  Future<List<MyCertification>> getMyCertifications();
  Future<CertificateDraft?> getDraft();
  Future<void> saveDraft(CertificateDraft draft);
  /// Adds a certificate; an empty [StudentCertificate.id] gets a generated one.
  Future<StudentCertificate> issue(StudentCertificate cert);
  Future<void> update(StudentCertificate cert);
  /// Revokes (removes) a certificate.
  Future<void> revoke(String id);
  /// Appends to the certificates activity log (shares, issues).
  Future<void> logActivity(String text);
  Stream<void> watch();
}
