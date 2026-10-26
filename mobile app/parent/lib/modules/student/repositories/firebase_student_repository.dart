import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../family/models/family_models.dart';
import '../models/certificate_models.dart';
import '../models/student_models.dart';
import 'student_repository_interface.dart';

/// The child's profile from the school record (`students`, `classes`, `school`) with attendance from
/// `par_attendance` and the score from published results (`par_results`). Medical, transport, house and
/// documents are not kept by the school system yet and show as not recorded. Certificates are issued by the
/// office on request for now.
class FirebaseStudentRepository implements IStudentRepository {
  FirebaseStudentRepository(this._session);
  final ParentSession _session;

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
  Stream<List<Certificate>> watchCertificates(String childId) => Stream.value(const []);

  @override
  Future<Certificate> recordDownload({required String childId, required String certificateId}) async =>
      throw AppException(message: 'Certificates are issued by the school office.');

  @override
  Future<Certificate> requestCertificate({required String childId, required CertificateRequestType type, required String purpose}) async =>
      throw AppException(message: 'Certificate requests through the app are not available yet. Please ask the school office for a ${type.label}.');
}
