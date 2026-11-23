/// Turns the server's `staff_self` card (functions/staffSelf.js) into the read-only sections the Profile page shows,
/// mirroring the office dashboard's staff profile: label/value groups, the document list, the masked bank account
/// and the payroll history. Pure Dart so the adapter and tests share it.
library;

const _countries = {
  'IN': 'India', 'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'QA': 'Qatar', 'OM': 'Oman', 'KW': 'Kuwait', 'BH': 'Bahrain',
  'US': 'United States', 'GB': 'United Kingdom', 'NP': 'Nepal', 'LK': 'Sri Lanka', 'BD': 'Bangladesh', 'PK': 'Pakistan', 'SG': 'Singapore',
  'MY': 'Malaysia', 'AU': 'Australia', 'CA': 'Canada',
};

String countryName(String code) => _countries[code.toUpperCase()] ?? code;

Map<String, dynamic> _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : const {};
String _s(Object? v) => '${v ?? ''}'.trim();
/// The card's value, else the staff record's (the office may not have saved an HR profile yet).
String _or(Object? a, Object? b) => _s(a).isNotEmpty ? _s(a) : _s(b);

List<Map<String, String>> _fields(List<(String, String)> rows) =>
    [for (final (label, value) in rows) if (value.trim().isNotEmpty) {'label': label, 'value': value.trim()}];

List<Map<String, String>> _addressFields(Map<String, dynamic> a) => _fields([
  ('Address line 1', _s(a['line1'])), ('Address line 2', _s(a['line2'])), ('City / locality', _s(a['city'])),
  ('District', _s(a['district'])), ('State', _s(a['state'])), ('Country', countryName(_s(a['country']))), ('PIN / postal code', _s(a['pin'])),
]);

/// The profile sections in dashboard order. Each is `{key, title, groups: [[{label, value}]]}`; empty fields are
/// dropped and a section with nothing on file still appears (the page says so) so the teacher knows what the office keeps.
List<Map<String, dynamic>> profileSectionsOf(Map<String, dynamic> self, {Map<String, dynamic> staff = const {}}) {
  final basic = _map(self['basic']);
  final addresses = _map(self['addresses']);
  final emergency = _map(self['emergency']);
  final employment = _map(self['employment']);
  final teaching = _map(self['teaching']);
  final category = _s(self['category']);
  final designation = _or(self['designation'], staff['designation']);
  final driver = designation == 'Driver';
  final teacher = category == 'Teaching';
  final extra = [for (final s in teaching['additionalSubjects'] as List? ?? const []) _s(s)].where((s) => s.isNotEmpty).join(', ');
  final same = addresses['same'] == true;
  final quals = [
    for (final q in self['qualifications'] as List? ?? const [])
      if (q is Map)
        _fields([
          ('Qualification level', _s(q['level'])), ('Course', _s(q['course'])), ('Specialization', _s(q['specialization'])),
          ('Institution / university', _s(q['institution'])), ('Year of completion', _s(q['year'])), ('Grade / percentage', _s(q['grade'])),
        ]),
  ].where((g) => g.isNotEmpty).toList();
  Map<String, dynamic> section(String key, String title, List<List<Map<String, String>>> groups, {String note = ''}) =>
      {'key': key, 'title': title, 'groups': groups.where((g) => g.isNotEmpty).toList(), if (note.isNotEmpty) 'note': note};
  return [
    section('basic', 'Basic information', [
      _fields([
        ('Employee ID', _or(self['empId'], staff['empId'])),
        ('Full name', _or(self['name'], staff['name'])),
        ('First name', _s(basic['firstName'])), ('Middle name', _s(basic['middleName'])), ('Last name', _s(basic['lastName'])),
        ('Date of birth', _s(self['birthDate'])), ('Gender', _s(basic['gender'])), ('Nationality', countryName(_s(basic['nationality']))),
        ('Blood group', _s(self['bloodGroup'])), ('Marital status', _s(basic['maritalStatus'])),
        ('Mobile number', _or(self['phone'], staff['phone'])), ('Alternate mobile', _s(self['alternatePhone'])),
        ('Contact email', _or(self['email'], staff['email'])),
      ]),
    ]),
    section('address_current', 'Current address', [_addressFields(_map(addresses['current']))]),
    section('address_permanent', 'Permanent address', [if (!same) _addressFields(_map(addresses['permanent']))], note: same ? 'Same as current address' : ''),
    section('emergency', 'Emergency contact', [
      _fields([
        ('Name', _s(emergency['name'])), ('Relationship', _s(emergency['relationship'])), ('Mobile number', _s(emergency['mobile'])),
        ('Alternate number', _s(emergency['alternate'])), ('Address', _s(emergency['address'])),
      ]),
    ]),
    section('employment', 'Employment', [
      _fields([
        ('Staff category', category), ('Designation', designation), ('Department', _or(self['department'], staff['department'])),
        ('Joining date', _or(self['joined'], staff['joined'])), ('Employment type', _s(self['employmentType'])),
        ('Employment status', _or(employment['employmentStatus'], self['status'])),
        ('Probation period (months)', _s(employment['probationMonths'])), ('Work shift', _s(self['workShift'])),
        ('Contract start date', _s(employment['contractStart'])), ('Contract end date', _s(employment['contractEnd'])),
      ]),
    ]),
    if (teacher)
      section('teaching', 'Teaching details', [
        _fields([
          ('Subject', _s(teaching['primarySubject'])), ('Additional subjects', extra), ('Teaching level', _s(self['teachingLevel'])),
          ('Teaching experience (years)', _s(self['teachingExperience'])), ('Previous school', _s(teaching['previousSchool'])),
          ('Previous designation', _s(teaching['previousDesignation'])), ('TET / CTET qualified', _s(self['tet'])),
          ('TET / CTET certificate number', _s(teaching['tetCertificate'])), ('B.Ed / D.El.Ed qualification', _s(teaching['teachingQualification'])),
          ('Specialization', _s(teaching['specialization'])),
        ]),
      ])
    else if (driver)
      section('teaching', 'Driver details', [
        _fields([
          ('Driving licence number', _s(teaching['licenseNumber'])), ('Licence expiry date', _s(teaching['licenseExpiry'])),
          ('Previous work experience (years)', _s(teaching['workExperience'])), ('Previous organization', _s(teaching['previousOrganization'])),
          ('Relevant skills', _s(teaching['skills'])), ('Professional certification', _s(teaching['professionalCertification'])),
        ]),
      ])
    else
      section('teaching', 'Non-teaching details', [
        _fields([
          ('Previous work experience (years)', _s(teaching['workExperience'])), ('Previous organization', _s(teaching['previousOrganization'])),
          ('Relevant skills', _s(teaching['skills'])), ('Professional certification', _s(teaching['professionalCertification'])),
          ('Licence number', _s(teaching['licenseNumber'])),
        ]),
      ]),
    section('qualifications', 'Qualifications', quals),
  ];
}

/// Payroll bank details with the masked account number, or empty when none is saved.
List<Map<String, String>> profileBankOf(Map<String, dynamic> self) {
  final account = _map(_map(self['payroll'])['account']);
  if (account.isEmpty) return const [];
  return _fields([
    ('Account holder', _s(account['accountHolder'])), ('Bank', _s(account['bank'])), ('Branch', _s(account['branch'])),
    ('IFSC', _s(account['ifsc'])), ('Account number', _s(account['lastFour']).isEmpty ? '' : '•••• ${_s(account['lastFour'])}'),
  ]);
}

/// Payroll payments newest first, amounts in rupees.
List<Map<String, dynamic>> profilePaymentsOf(Map<String, dynamic> self) => [
  for (final p in _map(self['payroll'])['payments'] as List? ?? const [])
    if (p is Map)
      {
        'month': _s(p['month']), 'paidOn': _s(p['paidOn']), 'gross': ((p['grossPaise'] as num?) ?? 0) / 100,
        'deductions': ((p['deductionsPaise'] as num?) ?? 0) / 100, 'net': ((p['netPaise'] as num?) ?? 0) / 100, 'reference': _s(p['reference']),
      },
];

/// Uploaded documents (metadata only; the files stay with the office).
List<Map<String, String>> profileDocumentsOf(Map<String, dynamic> self) => [
  for (final d in self['documents'] as List? ?? const [])
    if (d is Map) {'id': _s(d['id']), 'category': _s(d['category']), 'label': _s(d['label']), 'name': _s(d['name']), 'uploadedAt': _s(d['uploadedAt'])},
];
