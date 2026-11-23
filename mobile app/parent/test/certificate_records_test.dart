import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/student/models/certificate_models.dart';
import 'package:parent_app/modules/student/repositories/firebase_student_repository.dart';

void main() {
  test('all six priority types can be requested by a parent', () {
    expect(
      CertificateRequestType.values.map((type) => type.name),
      containsAll([
        'bonafide',
        'character',
        'transfer',
        'study',
        'dob',
        'conduct',
      ]),
    );
  });
  test('a generated PDF is available without a legacy public file URL', () {
    final cert = FirebaseStudentRepository.certificateFromDoc('c1', {
      'schemaVersion': 2,
      'status': 'Issued',
      'title': 'Study Certificate',
      'issuer': 'Principal',
      'pdfPath': 'schools/s1/certificate-files/c1/file.pdf',
      'issuedOn': '2026-11-20',
    }, 'student');
    expect(cert.downloadable, isTrue);
    expect(cert.size, 'School copy');
    expect(cert.summary, isNot(contains('Collect the signed copy')));
  });
  test(
    'revoked certificates retain their issue date and never become pending or downloadable',
    () {
      final cert = FirebaseStudentRepository.certificateFromDoc('c1', {
        'status': 'Revoked',
        'title': 'Study Certificate',
        'issuer': 'Principal',
        'issuedOn': '2026-10-01',
      }, 'student');
      expect(cert.revoked, isTrue);
      expect(cert.requested, isFalse);
      expect(cert.downloadable, isFalse);
      expect(cert.issuedOn, DateTime(2026, 10, 1));
      expect(cert.tags.first, 'Revoked');
      expect(cert.copyWith(downloadedAt: DateTime(2026)).revoked, isTrue);
    },
  );
  test('an interrupted issue is still shown as being prepared', () {
    final cert = FirebaseStudentRepository.certificateFromDoc('c1', {
      'status': 'Preparing',
      'title': 'Bonafide Certificate',
      'requestedAt': '2026-11-20T10:00:00Z',
    }, 'student');
    expect(cert.requested, isTrue);
    expect(cert.downloadable, isFalse);
  });
  test('the preview retains the issued school and recipient names', () {
    final cert = FirebaseStudentRepository.certificateFromDoc('c1', {
      'status': 'Issued',
      'title': 'Study Certificate',
      'issuedOn': '2026-11-20',
      'schoolSnapshot': {'name': 'Issued School'},
      'recipientSnapshot': {'name': 'Name at issue'},
    }, 'student');
    expect(cert.schoolName, 'Issued School');
    expect(cert.recipientName, 'Name at issue');
    expect(
      cert.copyWith(downloadedAt: DateTime(2026)).recipientName,
      'Name at issue',
    );
  });
}
