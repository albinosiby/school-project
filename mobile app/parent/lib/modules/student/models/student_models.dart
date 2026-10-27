import 'package:equatable/equatable.dart';
import '../../family/models/family_models.dart';

/// "2026-27" for any date (the academic year starts in April).
String academicYearOf(DateTime d) {
  final y = d.month >= 4 ? d.year : d.year - 1;
  return '$y-${((y + 1) % 100).toString().padLeft(2, '0')}';
}

class GuardianContact extends Equatable {
  const GuardianContact({
    required this.name,
    required this.relation,
    required this.occupation,
    required this.phone,
    required this.email,
    this.primary = false,
  });
  final String name, relation, occupation, phone, email;
  final bool primary;
  @override
  List<Object?> get props => [
    name,
    relation,
    occupation,
    phone,
    email,
    primary,
  ];
}

class TransportInfo extends Equatable {
  const TransportInfo({
    required this.busNo,
    required this.route,
    required this.pickup,
    required this.drop,
    required this.stopName,
    required this.stopAddress,
    required this.driver,
    required this.driverPhone,
    required this.supervisorPhone,
  });
  final String busNo, route, pickup, drop, stopName, stopAddress;
  final String driver, driverPhone, supervisorPhone;
  @override
  List<Object?> get props => [
    busNo,
    route,
    pickup,
    drop,
    stopName,
    stopAddress,
    driver,
    driverPhone,
    supervisorPhone,
  ];
}

class MedicalInfo extends Equatable {
  const MedicalInfo({
    required this.bloodGroup,
    required this.allergies,
    required this.conditions,
    required this.medications,
    required this.doctor,
    required this.doctorPhone,
    required this.heightCm,
    required this.weightKg,
    required this.lastCheckup,
  });
  final String bloodGroup,
      allergies,
      conditions,
      medications,
      doctor,
      doctorPhone;
  final int heightCm, weightKg;
  final DateTime lastCheckup;
  @override
  List<Object?> get props => [
    bloodGroup,
    allergies,
    conditions,
    medications,
    doctor,
    doctorPhone,
    heightCm,
    weightKg,
    lastCheckup,
  ];
}

class EmergencyContact extends Equatable {
  const EmergencyContact({
    required this.name,
    required this.relation,
    required this.phone,
  });
  final String name, relation, phone;
  @override
  List<Object?> get props => [name, relation, phone];
}

enum HonorKind { academic, leadership, olympiad, sports, arts }

class Honor extends Equatable {
  const Honor({
    required this.title,
    required this.subtitle,
    required this.tag,
    required this.kind,
    required this.awardedOn,
  });
  final String title, subtitle, tag;
  final HonorKind kind;
  final DateTime awardedOn;
  @override
  List<Object?> get props => [title, subtitle, tag, kind, awardedOn];
}

class StudentDocument extends Equatable {
  const StudentDocument({
    required this.id,
    required this.name,
    required this.size,
    required this.verified,
  });
  final String id, name, size;
  final bool verified;
  @override
  List<Object?> get props => [id, name, size, verified];
}

/// Everything on the 5.1 Student Profile screen for one child.
class StudentProfile extends Equatable {
  const StudentProfile({
    required this.child,
    required this.academicYear,
    required this.dob,
    required this.gender,
    required this.admissionDate,
    required this.house,
    required this.houseRole,
    required this.present,
    required this.absent,
    required this.workingDays,
    required this.attendancePercent,
    required this.cgpa,
    required this.cgpaTag,
    required this.evaluation,
    required this.meritPoints,
    required this.meritTag,
    required this.honors,
    required this.guardians,
    required this.address,
    required this.addressVerified,
    required this.transport,
    required this.medical,
    required this.emergency,
    required this.documents,
  });

  final Child child;
  final String academicYear, gender, house, houseRole;
  final DateTime dob, admissionDate;
  final int present, absent, workingDays;
  final double attendancePercent;

  /// Latest published exam on a 10-point scale; null before the first result.
  final double? cgpa;
  final String cgpaTag, evaluation;
  final int meritPoints;
  final String meritTag;
  final List<Honor> honors;
  final List<GuardianContact> guardians;
  final String address;
  final bool addressVerified;
  final TransportInfo transport;
  final MedicalInfo medical;
  final EmergencyContact emergency;
  final List<StudentDocument> documents;

  /// "On Track" from 90%, "Needs Attention" from 75%, else "At Risk".
  String get attendanceLabel => attendancePercent >= 90
      ? 'On Track'
      : attendancePercent >= 75
      ? 'Needs Attention'
      : 'At Risk';

  int ageAt(DateTime now) {
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day))
      age--;
    return age;
  }

  @override
  List<Object?> get props => [
    child,
    academicYear,
    dob,
    gender,
    admissionDate,
    house,
    houseRole,
    present,
    absent,
    workingDays,
    attendancePercent,
    cgpa,
    cgpaTag,
    evaluation,
    meritPoints,
    meritTag,
    honors,
    guardians,
    address,
    addressVerified,
    transport,
    medical,
    emergency,
    documents,
  ];
}
