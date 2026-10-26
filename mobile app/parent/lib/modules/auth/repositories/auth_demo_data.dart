import '../../../constants/app_constants.dart';
import '../models/auth_models.dart';

/// Demo values for the onboarding screens (school badge, helpdesk, demo passcode, admission records).
class AuthDemoData {
  AuthDemoData._();

  /// Every demo passcode is this code (shown as a hint on the OTP screen).
  static const demoOtp = '482916';

  static const school = AppConstants.schoolName;
  static const affiliation = 'CBSE Affiliated #2730164 • Central Board';
  static const verification = 'CBSE Affiliated • Guardian Verification';
  static const board = 'CBSE';

  static const helpdeskPhone = '+91 (011) 4567-8900';
  static const helpdeskTel = 'tel:+911145678900';

  /// Admission records a new parent can link (Aarav and Ananya match the demo family).
  static final admissionRecords = [
    StudentMatch(
      admissionNo: 'GIS-2021-0142',
      name: 'Aarav Sharma',
      className: '10-B',
      rollNo: 14,
      dob: DateTime(2010, 8, 14),
      school: school,
    ),
    StudentMatch(
      admissionNo: 'GIS-2023-0318',
      name: 'Ananya Sharma',
      className: '8-C',
      rollNo: 27,
      dob: DateTime(2012, 3, 22),
      school: school,
    ),
    StudentMatch(
      admissionNo: 'GIS-2024-0457',
      name: 'Kabir Verma',
      className: '6-A',
      rollNo: 9,
      dob: DateTime(2014, 11, 5),
      school: school,
    ),
  ];
}
