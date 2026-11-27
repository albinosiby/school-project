import 'package:equatable/equatable.dart';

String _s(dynamic v) => v == null ? '' : '$v';

/// One contact of a student's admission record (father, mother or guardian).
class StudentContact extends Equatable {
  const StudentContact({this.name = '', this.phone = '', this.email = '', this.occupation = '', this.relationship = '', this.address = ''});
  final String name, phone, email, occupation, relationship, address;
  bool get isEmpty => name.isEmpty && phone.isEmpty && email.isEmpty;
  factory StudentContact.fromJson(Object? v) {
    final j = v is Map ? v : const {};
    return StudentContact(
      name: _s(j['name']),
      phone: _s(j['phone']),
      email: _s(j['email']),
      occupation: _s(j['occupation']),
      relationship: _s(j['relationship']),
      address: _s(j['address']),
    );
  }
  Map<String, dynamic> toJson() => {'name': name, 'phone': phone, 'email': email, 'occupation': occupation, 'relationship': relationship, 'address': address};
  StudentContact copyWith({String? name, String? phone, String? email, String? occupation, String? relationship, String? address}) => StudentContact(
    name: name ?? this.name,
    phone: phone ?? this.phone,
    email: email ?? this.email,
    occupation: occupation ?? this.occupation,
    relationship: relationship ?? this.relationship,
    address: address ?? this.address,
  );
  @override
  List<Object?> get props => [name, phone, email, occupation, relationship, address];
}

/// Home address of the admission record.
class StudentAddress extends Equatable {
  const StudentAddress({this.line1 = '', this.line2 = '', this.city = '', this.district = '', this.state = '', this.pin = '', this.country = ''});
  final String line1, line2, city, district, state, pin, country;
  bool get isEmpty => [line1, line2, city, district, state, pin].every((e) => e.isEmpty);
  String get oneLine => [line1, line2, city, district, state, pin].where((e) => e.isNotEmpty).join(', ');
  factory StudentAddress.fromJson(Object? v) {
    final j = v is Map ? v : const {};
    return StudentAddress(
      line1: _s(j['addressLine1']),
      line2: _s(j['addressLine2']),
      city: _s(j['city']),
      district: _s(j['district']),
      state: _s(j['state']),
      pin: _s(j['pin']),
      country: _s(j['country']),
    );
  }
  Map<String, dynamic> toJson() => {
    'addressLine1': line1,
    'addressLine2': line2,
    'city': city,
    'district': district,
    'state': state,
    'pin': pin,
    'country': country,
  };
  @override
  List<Object?> get props => [line1, line2, city, district, state, pin, country];
}

const contactKinds = ['father', 'mother', 'guardian'];
const contactLabels = {'father': 'Father', 'mother': 'Mother', 'guardian': 'Guardian'};
const bloodGroups = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/// A student's full record as the class teacher sees it (getClassStudentDetails): the student document plus the
/// admission record, without caste / category / religion.
class StudentDetails extends Equatable {
  const StudentDetails({
    required this.studentId,
    this.exists = false,
    this.gender = '',
    this.dob = '',
    this.email = '',
    this.nationality = '',
    this.motherTongue = '',
    this.language = '',
    this.residence = const StudentAddress(),
    this.address = '',
    this.contacts = const {},
    this.primary = 'guardian',
    this.secondary = '',
    this.emergencyPhone = '',
    this.admissionDate = '',
    this.admissionNumber = '',
    this.academicYear = '',
    this.studentType = '',
    this.admissionType = '',
    this.previousSchool = '',
    this.previousClass = '',
    this.previousBoard = '',
    this.bloodGroup = '',
    this.conditions = '',
    this.assistance = '',
    this.bus = '',
    this.busStop = '',
    this.stream = '',
    this.status = 'Active',
    this.updatedAt = '',
    this.fetchedAt = '',
  });

  final String studentId, gender, dob, email, nationality, motherTongue, language, address, primary, secondary, emergencyPhone;
  final String admissionDate, admissionNumber, academicYear, studentType, admissionType, previousSchool, previousClass, previousBoard;
  final String bloodGroup, conditions, assistance, bus, busStop, stream, status, updatedAt;

  /// When this copy came from the server (ISO); shown as "updated …" when the screen falls back to the cache.
  final String fetchedAt;

  /// Whether the office filled in an admission record at all.
  final bool exists;
  final StudentAddress residence;
  final Map<String, StudentContact> contacts;

  StudentContact contact(String kind) => contacts[kind] ?? const StudentContact();

  /// Contacts that carry something, primary first.
  List<(String kind, StudentContact c)> get filledContacts => [
    for (final k in [primary, ...contactKinds.where((k) => k != primary)])
      if (!contact(k).isEmpty) (k, contact(k)),
  ];

  bool get hasMedical => bloodGroup.isNotEmpty || conditions.isNotEmpty || assistance.isNotEmpty;
  String get homeAddress => residence.isEmpty ? address : residence.oneLine;

  factory StudentDetails.fromJson(String studentId, Map<String, dynamic> j) => StudentDetails(
    studentId: studentId,
    exists: j['exists'] == true,
    gender: _s(j['gender']),
    dob: _s(j['dob']),
    email: _s(j['email']),
    nationality: _s(j['nationality']),
    motherTongue: _s(j['motherTongue']),
    language: _s(j['language']),
    residence: StudentAddress.fromJson(j['residence']),
    address: _s(j['address']),
    contacts: {for (final k in contactKinds) k: StudentContact.fromJson((j['contacts'] is Map ? j['contacts'] as Map : const {})[k])},
    primary: contactKinds.contains(j['primary']) ? '${j['primary']}' : 'guardian',
    secondary: contactKinds.contains(j['secondary']) ? '${j['secondary']}' : '',
    emergencyPhone: _s(j['emergencyPhone']),
    admissionDate: _s(j['admissionDate']),
    admissionNumber: _s(j['admissionNumber']),
    academicYear: _s(j['academicYear']),
    studentType: _s(j['studentType']),
    admissionType: _s(j['admissionType']),
    previousSchool: _s(j['previousSchool']),
    previousClass: _s(j['previousClass']),
    previousBoard: _s(j['previousBoard']),
    bloodGroup: _s(j['bloodGroup']),
    conditions: _s(j['conditions']),
    assistance: _s(j['assistance']),
    bus: _s(j['bus']),
    busStop: _s(j['busStop']),
    stream: _s(j['stream']),
    status: _s(j['status']).isEmpty ? 'Active' : _s(j['status']),
    updatedAt: _s(j['updatedAt']),
    fetchedAt: _s(j['fetchedAt']),
  );

  Map<String, dynamic> toJson() => {
    'exists': exists,
    'gender': gender,
    'dob': dob,
    'email': email,
    'nationality': nationality,
    'motherTongue': motherTongue,
    'language': language,
    'residence': residence.toJson(),
    'address': address,
    'contacts': {for (final e in contacts.entries) e.key: e.value.toJson()},
    'primary': primary,
    'secondary': secondary,
    'emergencyPhone': emergencyPhone,
    'admissionDate': admissionDate,
    'admissionNumber': admissionNumber,
    'academicYear': academicYear,
    'studentType': studentType,
    'admissionType': admissionType,
    'previousSchool': previousSchool,
    'previousClass': previousClass,
    'previousBoard': previousBoard,
    'bloodGroup': bloodGroup,
    'conditions': conditions,
    'assistance': assistance,
    'bus': bus,
    'busStop': busStop,
    'stream': stream,
    'status': status,
    'updatedAt': updatedAt,
    'fetchedAt': fetchedAt,
  };

  @override
  List<Object?> get props => [studentId, toJson()];
}

/// What the class teacher changes in one save (only the keys present are sent).
class StudentDetailsPatch {
  const StudentDetailsPatch({this.contacts, this.primary, this.secondary, this.emergencyPhone, this.residence, this.bloodGroup, this.conditions, this.assistance});
  final Map<String, StudentContact>? contacts;
  final String? primary, secondary, emergencyPhone, bloodGroup, conditions, assistance;
  final StudentAddress? residence;

  Map<String, dynamic> toJson() => {
    if (contacts != null) 'contacts': {for (final e in contacts!.entries) e.key: e.value.toJson()},
    'primary': ?primary,
    'secondary': ?secondary,
    'emergencyPhone': ?emergencyPhone,
    if (residence != null) 'residence': residence!.toJson(),
    'bloodGroup': ?bloodGroup,
    'conditions': ?conditions,
    'assistance': ?assistance,
  };

  /// [d] with this patch applied (for the local backend and optimistic display).
  StudentDetails applyTo(StudentDetails d) => StudentDetails.fromJson(d.studentId, {
    ...d.toJson(),
    'exists': true,
    if (contacts != null) 'contacts': {...d.toJson()['contacts'] as Map, for (final e in contacts!.entries) e.key: e.value.toJson()},
    'primary': ?primary,
    'secondary': ?secondary,
    'emergencyPhone': ?emergencyPhone,
    if (residence != null) 'residence': residence!.toJson(),
    'bloodGroup': ?bloodGroup,
    'conditions': ?conditions,
    'assistance': ?assistance,
    'updatedAt': DateTime.now().toIso8601String(),
  });
}
