import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../config/app_config.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/link_launcher.dart';
import '../../family/models/family_models.dart';
import '../models/certificate_models.dart';
import '../models/student_models.dart';
import 'student_repository_interface.dart';

/// The child's profile from the school record (`students`, `classes`, `school`) with attendance from
/// `par_attendance` and the score from published results (`par_results`). Medical, transport, house and
/// documents are not kept by the school system yet and show as not recorded. Certificates (`certificates`, §13.7)
/// are requested here and issued by the office in the admin web.
class FirebaseStudentRepository implements IStudentRepository {
  FirebaseStudentRepository(this._session, this._links);
  final ParentSession _session;
  final LinkLauncher _links;

  static const _none = 'Not recorded';

  @override
  Stream<StudentProfile> watchProfile(String childId) {
    final student = _session.col('students').doc(childId).snapshots();
    final attendance = _session.col('par_attendance').where('studentId', isEqualTo: childId).snapshots();
    final results = _session.col('par_results').where('studentId', isEqualTo: childId).snapshots();
    return combineLatest<Object>([student, attendance, results]).asyncMap((all) async {
      final d = (all[0] as DocumentSnapshot<Json>).data() ?? const <String, dynamic>{};
      final cid = '${d['classId'] ?? ''}';
      final cls = cid.isEmpty ? null : (await _session.col('classes').doc(cid).get()).data();
      final school = (await _session.col('school').doc('school').get()).data() ?? const {};
      var present = 0, absent = 0, working = 0;
      for (final doc in (all[1] as QuerySnapshot<Json>).docs) {
        final days = doc.data()['days'];
        if (days is! Map) continue;
        for (final c in days.values) {
          working++;
          if (c == 'P' || c == 'L') present++;
          if (c == 'A') absent++;
        }
      }
      final papers = (all[2] as QuerySnapshot<Json>).docs.map((p) => p.data()).toList();
      final got = papers.fold<double>(0, (a, p) => a + ((p['obtained'] as num?)?.toDouble() ?? 0));
      final max = papers.fold<double>(0, (a, p) => a + ((p['max'] as num?)?.toDouble() ?? 0));
      final cgpa = max == 0 ? null : double.parse((got / max * 10).toStringAsFixed(1));
      final guardian = GuardianContact(
        name: '${d['guardian'] ?? _session.user['name'] ?? ''}',
        relation: '${d['relation'] ?? 'Parent'}',
        occupation: '',
        phone: '${d['phone'] ?? ''}',
        email: '${d['guardianEmail'] ?? d['email'] ?? ''}',
        primary: true,
      );
      return StudentProfile(
        child: Child(
          id: childId,
          name: '${d['name'] ?? ''}',
          grade: '${d['grade'] ?? ''}',
          section: '${d['section'] ?? ''}',
          rollNo: (d['roll'] as num?)?.toInt() ?? 0,
          admissionNo: '${d['grn'] ?? ''}',
          classTeacher: '${cls?['classTeacher'] ?? ''}',
        ),
        academicYear: '${school['academicYear'] ?? ''}',
        dob: parseDay(d['dob']) ?? DateTime(2000),
        gender: '${d['gender'] ?? ''}',
        admissionDate: parseDay(d['admissionDate']) ?? parseTime(d['createdAt']) ?? DateTime.now(),
        house: '${d['house'] ?? ''}',
        houseRole: '',
        present: present,
        absent: absent,
        workingDays: working,
        attendancePercent: working == 0 ? 0 : present / working * 100,
        cgpa: cgpa,
        cgpaTag: cgpa == null ? 'No results yet' : 'Published results',
        evaluation: cgpa == null ? '' : '${papers.length} subject${papers.length == 1 ? '' : 's'} published',
        meritPoints: 0,
        meritTag: '',
        honors: const [],
        guardians: [guardian],
        address: '${d['address'] ?? ''}',
        addressVerified: false,
        transport: const TransportInfo(busNo: '', route: _none, pickup: '', drop: '', stopName: '', stopAddress: '', driver: '', driverPhone: '', supervisorPhone: ''),
        medical: MedicalInfo(bloodGroup: '${d['bloodGroup'] ?? ''}', allergies: _none, conditions: _none, medications: _none, doctor: '', doctorPhone: '', heightCm: 0, weightKg: 0, lastCheckup: DateTime.now()),
        emergency: EmergencyContact(name: guardian.name, relation: guardian.relation, phone: guardian.phone),
        documents: const [],
      );
    });
  }

  @override
  Stream<List<Certificate>> watchCertificates(String childId) => _session
      .whenReady(() => _session.col('certificates').where('studentId', isEqualTo: childId).snapshots())
      .map((q) => [for (final d in q.docs) if (d.data()['status'] != 'Rejected') certificateFromDoc(d.id, d.data(), childId)]
        ..sort((a, b) => b.issuedOn.compareTo(a.issuedOn)));

  /// Opens the signed PDF when the office attached one; otherwise the signed copy is collected at the office.
  @override
  Future<Certificate> recordDownload({required String childId, required String certificateId}) async {
    final ref = _session.col('certificates').doc(certificateId);
    final d = (await ref.get()).data();
    if (d == null || d['status'] != 'Issued') throw AppException(message: 'This certificate is still being prepared.');
    final url = '${d['fileUrl'] ?? ''}';
    if (url.isEmpty) {
      throw AppException(
        message: 'The signed copy${d['refNo'] == null ? '' : ' (ref ${d['refNo']})'} is ready to collect from the school office.',
      );
    }
    await _links.open(_reachable(url));
    final at = nowUtc();
    try {
      await ref.update({'downloadedAt': at, 'updatedAt': at, 'updatedBy': _session.uid});
    } catch (_) {
      // opening the file is what matters; the "downloaded" mark is a convenience
    }
    return certificateFromDoc(certificateId, {...d, 'downloadedAt': at}, childId);
  }

  /// Test builds on a phone reach the emulators over Wi-Fi: a Storage emulator link made on the computer says localhost.
  static String _reachable(String url) =>
      AppConfig.useEmulator ? url.replaceFirst('://localhost:', '://${AppConfig.emulatorHost}:') : url;

  @override
  Future<Certificate> requestCertificate({required String childId, required CertificateRequestType type, required String purpose}) async {
    final child = await _session.student(childId);
    final now = nowUtc();
    final data = <String, dynamic>{
      'studentId': childId,
      'classId': '${child['classId'] ?? ''}',
      'studentName': '${child['name'] ?? ''}',
      'grn': '${child['grn'] ?? ''}',
      'type': type.name,
      'title': type.label,
      'category': type.category.name,
      'purpose': purpose.trim(),
      'status': 'Requested',
      'requestedBy': '${_session.user['name'] ?? _session.user['email'] ?? ''}',
      'requestedAt': now,
      'parentUid': _session.uid,
      'updatedAt': now,
      'updatedBy': _session.uid,
    };
    final ref = await _session.col('certificates').add(data);
    return certificateFromDoc(ref.id, data, childId);
  }

  static CertificateCategory categoryOf(Object? v) =>
      CertificateCategory.values.where((c) => c.name == '$v').firstOrNull ?? CertificateCategory.bonafide;

  static Certificate certificateFromDoc(String id, Json d, String childId) {
    final requested = d['status'] != 'Issued';
    final hasFile = '${d['fileUrl'] ?? ''}'.isNotEmpty;
    return Certificate(
      id: id,
      childId: childId,
      title: '${d['title'] ?? 'Certificate'}',
      category: categoryOf(d['category']),
      issuer: '${d['issuer'] ?? 'School office'}',
      summary: requested
          ? 'Requested${'${d['purpose'] ?? ''}'.isEmpty ? '' : ' for ${d['purpose']}'}. The office will notify you when it is ready.'
          : ['${d['note'] ?? ''}', hasFile ? '' : 'Collect the signed copy from the school office.'].where((s) => s.isNotEmpty).join(' '),
      issuedOn: (requested ? parseTime(d['requestedAt']) : parseDay(d['issuedOn'])) ?? parseTime(d['updatedAt']) ?? DateTime.now(),
      tags: [if (requested) 'Requested' else 'Issued', if ('${d['refNo'] ?? ''}'.isNotEmpty) '${d['refNo']}'],
      size: hasFile ? 'Signed copy' : '',
      signature: requested ? 'Pending' : 'Signed by ${d['issuer'] ?? 'the school'}',
      refNo: '${d['refNo'] ?? ''}'.isEmpty ? null : '${d['refNo']}',
      validTill: parseDay(d['validTill']),
      downloadedAt: parseTime(d['downloadedAt']),
      requested: requested,
      purpose: '${d['purpose'] ?? ''}'.isEmpty ? null : '${d['purpose']}',
    );
  }
}
