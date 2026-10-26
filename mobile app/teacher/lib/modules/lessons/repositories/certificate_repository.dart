import '../../../utils/services/data_store.dart';
import '../models/certificate_models.dart';
import 'certificate_repository_interface.dart';

class LocalCertificateRepository implements ICertificateRepository {
  LocalCertificateRepository(this._db);
  final DataStore _db;
  static const _certs = 'cr_certs';

  @override
  Future<List<StudentCertificate>> getCertificates() async => [for (final r in _db.list(_certs)) StudentCertificate.fromJson(r)];

  @override
  Future<List<CertTemplate>> getTemplates() async => [for (final r in _db.list('cr_templates')) CertTemplate.fromJson(r)];

  @override
  Future<List<MyCertification>> getMyCertifications() async => [for (final r in _db.list('cr_mine')) MyCertification.fromJson(r)];

  @override
  Future<CertificateDraft?> getDraft() async => CertificateDraft.fromJson(_db.doc('cr_draft'));

  @override
  Future<void> saveDraft(CertificateDraft draft) async => _db.setDoc('cr_draft', draft.toJson());

  @override
  Future<StudentCertificate> issue(StudentCertificate cert) async {
    final json = cert.toJson();
    if (cert.id.isEmpty) json.remove('id');
    return StudentCertificate.fromJson(_db.add(_certs, json));
  }

  @override
  Future<void> update(StudentCertificate cert) async => _db.update(_certs, cert.id, cert.toJson());

  @override
  Future<void> revoke(String id) async => _db.remove(_certs, id);

  @override
  Future<void> logActivity(String text) async => _db.add('cr_activity', {'text': text, 'at': DateTime.now().toIso8601String()});

  @override
  Stream<void> watch() => _db.watch({_certs, 'cr_templates', 'cr_mine', 'cr_draft'});
}
