import 'package:url_launcher/url_launcher.dart';
import '../../../src/mobile_school_client.dart';
import '../models/staff_certificate.dart';

abstract class IStaffCertificatesRepository {
  Future<List<StaffCertificate>> load();
  Future<void> open(StaffCertificate certificate);
}

class EmptyStaffCertificatesRepository implements IStaffCertificatesRepository {
  @override
  Future<List<StaffCertificate>> load() async => const [];
  @override
  Future<void> open(StaffCertificate certificate) async =>
      throw const MobileSchoolException('Connect to your school to open certificates.');
}

class FirebaseStaffCertificatesRepository implements IStaffCertificatesRepository {
  FirebaseStaffCertificatesRepository(this.client);
  final MobileSchoolClient client;
  String? _schoolId;
  @override
  Future<List<StaffCertificate>> load() async {
    final result = await client.call('getMobileStaffCertificates');
    _schoolId = '${result['schoolId']}';
    const names = {
      'employment': 'Employment certificate',
      'experience': 'Experience certificate',
      'salary': 'Salary certificate',
      'service': 'Service certificate',
      'appreciation': 'Appreciation certificate',
      'relieving': 'Relieving certificate',
    };
    return [
      for (final row in result['certificates'] as List? ?? const [])
        if (row is Map)
          StaffCertificate(
            id: '${row['id']}',
            title: names[row['type']] ?? '${row['type']}',
            number: '${row['refNo']}',
            status: '${row['status']}',
            issuedOn: '${row['issuedOn']}',
          ),
    ];
  }

  @override
  Future<void> open(StaffCertificate certificate) async {
    if (!certificate.downloadable || _schoolId == null) throw const MobileSchoolException('An issued PDF is not available.');
    final result = await client.call('downloadCertificate', {'schoolId': _schoolId, 'certificateId': certificate.id, 'format': 'url'});
    final value = client.reachableUrl('${result['url'] ?? ''}');
    final url = Uri.tryParse(value);
    if (url == null ||
        (url.scheme != 'https' && !(client.emulator && url.scheme == 'http')) ||
        !await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw const MobileSchoolException('Could not open the certificate. Try again.');
    }
  }
}
