import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/utils/helpers/staff_profile_sections.dart';

void main() {
  final self = {
    'name': 'Fathima Beevi', 'empId': 'FUS-0064', 'status': 'Active', 'category': 'Teaching', 'designation': 'Teacher', 'department': 'Academics',
    'phone': '9876543210', 'email': 'f@x.in', 'bloodGroup': 'O+', 'joined': '2012-06-01', 'birthDate': '1985-02-10', 'employmentType': 'Permanent',
    'teachingExperience': '12', 'tet': 'Yes', 'updatedAt': '2026-11-23T10:00:00.000Z',
    'basic': {'firstName': 'Fathima', 'lastName': 'Beevi', 'gender': 'Female', 'nationality': 'IN', 'maritalStatus': 'Married'},
    'addresses': {'current': {'line1': '12 Beach Rd', 'city': 'Kannur', 'state': 'Kerala', 'country': 'IN', 'pin': '670001'}, 'permanent': {'line1': '12 Beach Rd'}, 'same': true},
    'emergency': {'name': 'Rasheed', 'relationship': 'Spouse', 'mobile': '9876500000', 'alternate': '', 'address': ''},
    'employment': {'probationMonths': '6', 'contractStart': '', 'contractEnd': '', 'employmentStatus': 'Active'},
    'teaching': {'primarySubject': 'English', 'additionalSubjects': ['Hindi', 'Art'], 'previousSchool': "St. Mary's", 'tetCertificate': 'KTET-991'},
    'qualifications': [
      {'level': 'Postgraduate', 'course': 'M.A. English', 'institution': 'Kannur University', 'year': '2008', 'grade': 'First'},
      {'level': 'Graduate', 'course': 'B.A. English', 'institution': '', 'year': '2006', 'grade': ''},
    ],
    'documents': [{'id': 'd1', 'category': 'identity', 'label': 'Identity proof', 'name': 'aadhaar.pdf', 'uploadedAt': '2026-11-01T10:00:00.000Z'}],
    'payroll': {
      'account': {'accountHolder': 'Fathima Beevi', 'bank': 'SBI', 'branch': 'Kannur', 'ifsc': 'SBIN0001234', 'lastFour': '9012'},
      'payments': [{'month': '2026-10', 'paidOn': '2026-10-31', 'grossPaise': 4500000, 'deductionsPaise': 200000, 'netPaise': 4300000, 'reference': 'NEFT-1'}],
    },
  };

  Map<String, dynamic> section(List<Map<String, dynamic>> all, String key) => all.firstWhere((s) => s['key'] == key);
  Map<String, String> fields(Map<String, dynamic> s, [int group = 0]) =>
      {for (final f in (s['groups'] as List)[group] as List) (f as Map)['label'] as String: f['value'] as String};

  test('sections mirror the dashboard staff profile in its order, dropping empty fields', () {
    final all = profileSectionsOf(self);
    expect(all.map((s) => s['key']), ['basic', 'address_current', 'address_permanent', 'emergency', 'employment', 'teaching', 'qualifications']);
    final basic = fields(section(all, 'basic'));
    expect(basic['Employee ID'], 'FUS-0064');
    expect(basic['Nationality'], 'India');
    expect(basic['Gender'], 'Female');
    expect(basic.containsKey('Middle name'), isFalse);
    expect(fields(section(all, 'address_current'))['Country'], 'India');
    final permanent = section(all, 'address_permanent');
    expect(permanent['groups'], isEmpty);
    expect(permanent['note'], 'Same as current address');
    expect(fields(section(all, 'emergency')), {'Name': 'Rasheed', 'Relationship': 'Spouse', 'Mobile number': '9876500000'});
    final employment = fields(section(all, 'employment'));
    expect(employment['Employment type'], 'Permanent');
    expect(employment['Probation period (months)'], '6');
    expect(employment['Joining date'], '2012-06-01');
    final teaching = section(all, 'teaching');
    expect(teaching['title'], 'Teaching details');
    expect(fields(teaching)['Additional subjects'], 'Hindi, Art');
    expect(fields(teaching)['TET / CTET certificate number'], 'KTET-991');
    final quals = section(all, 'qualifications');
    expect((quals['groups'] as List).length, 2);
    expect(fields(quals, 1), {'Qualification level': 'Graduate', 'Course': 'B.A. English', 'Year of completion': '2006'});
  });

  test('non-teaching and driver staff get their own details section; the staff record fills gaps', () {
    final driver = profileSectionsOf({...self, 'category': 'Non-teaching', 'designation': 'Driver', 'teaching': {'licenseNumber': 'KL13 2020', 'licenseExpiry': '2029-01-01'}});
    expect(section(driver, 'teaching')['title'], 'Driver details');
    expect(fields(section(driver, 'teaching'))['Driving licence number'], 'KL13 2020');
    final office = profileSectionsOf({...self, 'category': 'Non-teaching', 'designation': 'Clerk', 'teaching': {'skills': 'Tally'}});
    expect(section(office, 'teaching')['title'], 'Non-teaching details');
    final bare = profileSectionsOf(const {}, staff: {'name': 'Mrs. Anita Sharma', 'empId': 'EMP-2041', 'joined': '2014-06-02'});
    expect(fields(section(bare, 'basic')), {'Employee ID': 'EMP-2041', 'Full name': 'Mrs. Anita Sharma'});
    expect(fields(section(bare, 'employment'))['Joining date'], '2014-06-02');
    expect(section(bare, 'qualifications')['groups'], isEmpty);
  });

  test('bank details stay masked, payments come in rupees and documents carry metadata only', () {
    expect(profileBankOf(self).map((f) => '${f['label']}: ${f['value']}'),
        ['Account holder: Fathima Beevi', 'Bank: SBI', 'Branch: Kannur', 'IFSC: SBIN0001234', 'Account number: •••• 9012']);
    expect(profileBankOf(const {}), isEmpty);
    expect(profilePaymentsOf(self).single, {'month': '2026-10', 'paidOn': '2026-10-31', 'gross': 45000.0, 'deductions': 2000.0, 'net': 43000.0, 'reference': 'NEFT-1'});
    expect(profileDocumentsOf(self).single, {'category': 'identity', 'label': 'Identity proof', 'name': 'aadhaar.pdf', 'uploadedAt': '2026-11-01T10:00:00.000Z'});
  });
}
