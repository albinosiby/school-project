import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/certificate_models.dart';
import '../models/student_models.dart';

/// Demo student profiles and certificates. Attendance and marks come from `DemoData` so the profile
/// snapshot matches the Academics tab.
class StudentDemoData {
  StudentDemoData._();

  static StudentProfile profile(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final child = DemoData.childById(childId);
    final aarav = childId == DemoData.aarav.id;
    final att = DemoData.attendance(childId, now: n).overall;
    final exams =
        DemoData.exams(childId, now: n).where((e) => e.published).toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final latest = exams.isEmpty ? null : exams.first;
    final g = DemoData.guardian;
    return StudentProfile(
      child: child,
      academicYear: academicYearOf(n),
      dob: aarav ? DateTime(n.year - 15, 3, 12) : DateTime(n.year - 13, 8, 24),
      gender: aarav ? 'Male' : 'Female',
      admissionDate: aarav
          ? DateTime(n.year - 5, 4, 2)
          : DateTime(n.year - 3, 4, 3),
      house: aarav ? 'Ashoka House' : 'Tagore House',
      houseRole: aarav ? 'House Captain' : 'Cultural Prefect',
      present: att.present,
      absent: att.absent,
      workingDays: att.workingDays,
      attendancePercent: att.percentage,
      cgpa: latest == null ? null : latest.percent.round() / 10,
      cgpaTag: latest == null
          ? 'Awaited'
          : latest.percent >= 91
          ? 'A1 Dist.'
          : '${latest.grade} Grade',
      evaluation: latest?.name ?? 'Term 1 Evaluation',
      meritPoints: aarav ? 42 : 28,
      meritTag: aarav ? 'Top 5%' : 'Top 15%',
      honors: aarav
          ? [
              Honor(
                title: 'Academic Leadership',
                subtitle: 'Peer Review & Guidance',
                tag: 'Term 1 Honor',
                kind: HonorKind.leadership,
                awardedOn: plusDays(-20, from: n),
              ),
              Honor(
                title: 'Junior Mathematics Olympiad',
                subtitle: 'Gold Medalist',
                tag: "Nat'l Rank #12",
                kind: HonorKind.olympiad,
                awardedOn: plusDays(-45, from: n),
              ),
              Honor(
                title: 'Science Exhibition',
                subtitle: 'First Prize, Inter-school',
                tag: 'Verified Honor',
                kind: HonorKind.academic,
                awardedOn: plusDays(-80, from: n),
              ),
              Honor(
                title: 'Inter-House Athletics',
                subtitle: '400 m Silver',
                tag: 'Sports Day',
                kind: HonorKind.sports,
                awardedOn: plusDays(-120, from: n),
              ),
            ]
          : [
              Honor(
                title: 'Reading Champion',
                subtitle: '50 books this year',
                tag: 'Library Honor',
                kind: HonorKind.academic,
                awardedOn: plusDays(-25, from: n),
              ),
              Honor(
                title: 'Annual Art Exhibition',
                subtitle: 'Best Watercolour',
                tag: 'Verified Honor',
                kind: HonorKind.arts,
                awardedOn: plusDays(-90, from: n),
              ),
            ],
      guardians: [
        GuardianContact(
          name: g.name.replaceFirst(RegExp(r'^Mr\.\s*'), ''),
          relation: g.relation,
          occupation: 'Software Architect',
          phone: g.phone,
          email: g.email,
          primary: true,
        ),
        const GuardianContact(
          name: 'Sunita Sharma',
          relation: 'Mother',
          occupation: 'Senior Consultant',
          phone: '+91 98110 44210',
          email: 'sunita.sharma@example.com',
        ),
      ],
      address: 'B-42, Sector 14, R.K. Puram, New Delhi - 110022',
      addressVerified: true,
      transport: TransportInfo(
        busNo: aarav ? 'Bus #14' : 'Bus #09',
        route: aarav ? 'Route 4B' : 'Route 2A',
        pickup: aarav ? '07:15 AM' : '07:25 AM',
        drop: aarav ? '03:45 PM' : '02:55 PM',
        stopName: 'Designated Stop #12',
        stopAddress: 'Sector 14 Home Gate, Main Road',
        driver: aarav ? 'Mahesh Singh' : 'Ravi Kumar',
        driverPhone: aarav ? '+91 98711 02233' : '+91 98711 05519',
        supervisorPhone: '+91 98711 02450',
      ),
      medical: MedicalInfo(
        bloodGroup: aarav ? 'B+' : 'O+',
        allergies: aarav ? 'Peanuts (mild)' : 'None reported',
        conditions: aarav ? 'Mild asthma - inhaler in school bag' : 'None',
        medications: aarav ? 'Salbutamol inhaler (as needed)' : 'None',
        doctor: 'Dr. Meera Kapoor',
        doctorPhone: '+91 98100 77120',
        heightCm: aarav ? 168 : 152,
        weightKg: aarav ? 56 : 41,
        lastCheckup: plusDays(-60, from: n),
      ),
      emergency: const EmergencyContact(
        name: 'Sunita Sharma',
        relation: 'Mother',
        phone: '+91 98110 44210',
      ),
      documents: [
        StudentDocument(
          id: 'doc_${childId}_birth',
          name: 'Birth_Certificate.pdf',
          size: '420 KB',
          verified: true,
        ),
        StudentDocument(
          id: 'doc_${childId}_aadhaar',
          name: 'Aadhaar_XXXX_4821.pdf',
          size: '310 KB',
          verified: true,
        ),
        StudentDocument(
          id: 'doc_${childId}_medical',
          name: 'Medical_Fitness_${academicYearOf(n)}.pdf',
          size: '265 KB',
          verified: true,
        ),
        StudentDocument(
          id: 'doc_${childId}_photo',
          name: 'Passport_Photo.jpg',
          size: '96 KB',
          verified: !aarav,
        ),
      ],
    );
  }

  static List<Certificate> certificates(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final ay = academicYearOf(n);
    final ayEnd = DateTime(int.parse(ay.substring(0, 4)) + 1, 3, 31);
    const school = 'Greenfield International School';
    if (childId == DemoData.aarav.id) {
      return [
        Certificate(
          id: 'crt_a1',
          childId: childId,
          title: 'Academic Excellence Award',
          category: CertificateCategory.academic,
          issuer: school,
          summary: 'Term 1 • $school',
          issuedOn: plusDays(-12, from: n),
          tags: const ['CBSE Digital Vault', '300 DPI Print Ready'],
          size: '1.4 MB',
          signature: 'Cryptographically Signed',
          refNo: 'GIS/AEA/${n.year}/014',
        ),
        Certificate(
          id: 'crt_a2',
          childId: childId,
          title: 'Official Bonafide Student Certificate',
          category: CertificateCategory.bonafide,
          issuer: school,
          summary: 'Academic Year $ay • Valid till 31 Mar ${ayEnd.year}',
          issuedOn: plusDays(-30, from: n),
          tags: const ['Ref: GIS/BNF/098', 'Tamper-Proof Hologram'],
          size: '840 KB',
          signature: 'Digitally Stamped',
          refNo: 'GIS/BNF/${n.year}/098',
          validTill: ayEnd,
        ),
        Certificate(
          id: 'crt_a3',
          childId: childId,
          title: 'Junior Mathematics Olympiad Certificate',
          category: CertificateCategory.academic,
          issuer: 'STEM Council & CBSE Board',
          summary: 'STEM Council & CBSE Board',
          issuedOn: plusDays(-45, from: n),
          tags: const ['99.4 Percentile', 'CBSE Level 2 Qualified'],
          size: '2.1 MB',
          signature: 'Distinction Grade',
          refNo: 'JMO/${n.year}/L2/1882',
        ),
        Certificate(
          id: 'crt_a4',
          childId: childId,
          title: 'Science Exhibition Merit Certificate',
          category: CertificateCategory.academic,
          issuer: 'Delhi Inter-school Science Fair',
          summary: 'Inter-school Science Fair • Team project',
          issuedOn: plusDays(-80, from: n),
          tags: const ['First Prize', 'Team of 3'],
          size: '1.1 MB',
          signature: 'Digitally Signed',
        ),
        Certificate(
          id: 'crt_a5',
          childId: childId,
          title: 'Character Certificate',
          category: CertificateCategory.bonafide,
          issuer: school,
          summary: 'Issued by the Principal • Conduct: Excellent',
          issuedOn: plusDays(-150, from: n),
          tags: const ['Principal Signed', 'School Seal'],
          size: '620 KB',
          signature: 'Digitally Stamped',
          refNo: 'GIS/CHR/${n.year}/041',
        ),
        Certificate(
          id: 'crt_a6',
          childId: childId,
          title: 'Inter-House Athletics - 400 m Silver',
          category: CertificateCategory.sports,
          issuer: school,
          summary: 'Annual Sports Day • Ashoka House',
          issuedOn: plusDays(-120, from: n),
          tags: const ['Silver Medal', 'House Points +8'],
          size: '980 KB',
          signature: 'Digitally Signed',
        ),
      ];
    }
    return [
      Certificate(
        id: 'crt_n1',
        childId: childId,
        title: 'Reading Champion Certificate',
        category: CertificateCategory.academic,
        issuer: school,
        summary: 'Library Programme • 50 books',
        issuedOn: plusDays(-25, from: n),
        tags: const ['Library Honor', 'Print Ready'],
        size: '760 KB',
        signature: 'Digitally Signed',
      ),
      Certificate(
        id: 'crt_n2',
        childId: childId,
        title: 'Official Bonafide Student Certificate',
        category: CertificateCategory.bonafide,
        issuer: school,
        summary: 'Academic Year $ay • Valid till 31 Mar ${ayEnd.year}',
        issuedOn: plusDays(-40, from: n),
        tags: const ['Ref: GIS/BNF/131', 'Tamper-Proof Hologram'],
        size: '840 KB',
        signature: 'Digitally Stamped',
        refNo: 'GIS/BNF/${n.year}/131',
        validTill: ayEnd,
      ),
      Certificate(
        id: 'crt_n3',
        childId: childId,
        title: 'Annual Art Exhibition - Best Watercolour',
        category: CertificateCategory.sports,
        issuer: school,
        summary: 'Art & Culture Week',
        issuedOn: plusDays(-90, from: n),
        tags: const ['Winner', 'Exhibited Work'],
        size: '1.3 MB',
        signature: 'Digitally Signed',
      ),
    ];
  }
}
