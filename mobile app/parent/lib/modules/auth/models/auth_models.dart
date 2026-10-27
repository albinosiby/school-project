import 'package:equatable/equatable.dart';

/// Where a one-time passcode was sent (Onboarding 3 "Didn't receive passcode?").
enum OtpChannel { sms, whatsapp, voice }

/// Simulated third-party sign-in providers (Onboarding 1 / 2 quick access).
enum SocialProvider { google, apple }

extension SocialProviderLabel on SocialProvider {
  String get label => switch (this) {
    SocialProvider.google => 'Google',
    SocialProvider.apple => 'Apple ID',
  };
}

/// A pending sign-in that waits for the 6-digit passcode.
class OtpChallenge extends Equatable {
  const OtpChallenge({
    required this.id,
    required this.phone,
    required this.channel,
    required this.sentAt,
    required this.expiresAt,
  });
  final String id;

  /// Display form, e.g. "+91 98765 43210".
  final String phone;
  final OtpChannel channel;
  final DateTime sentAt, expiresAt;

  static const codeLength = 6;
  static const maxAttempts = 3;
  static const resendAfter = Duration(seconds: 40);

  bool isExpiredAt(DateTime now) => !now.isBefore(expiresAt);

  @override
  List<Object?> get props => [id, phone, channel, sentAt, expiresAt];
}

/// A student record found by admission number + date of birth (Onboarding 1.1).
class StudentMatch extends Equatable {
  const StudentMatch({
    required this.admissionNo,
    required this.name,
    required this.className,
    required this.rollNo,
    required this.dob,
    required this.school,
  });
  final String admissionNo, name, className, school;
  final int rollNo;
  final DateTime dob;

  /// "gis/2021/0142 " -> "GIS-2021-0142".
  static String normalise(String admissionNo) =>
      admissionNo.trim().toUpperCase().replaceAll(RegExp(r'[\s/]+'), '-');

  @override
  List<Object?> get props => [
    admissionNo,
    name,
    className,
    rollNo,
    dob,
    school,
  ];
}

class RegistrationRequest extends Equatable {
  const RegistrationRequest({
    required this.students,
    required this.guardianName,
    required this.relation,
    required this.phone,
  });
  final List<StudentMatch> students;
  final String guardianName, relation;

  /// 10 digits, without the +91 prefix.
  final String phone;

  @override
  List<Object?> get props => [students, guardianName, relation, phone];
}

/// A guardian registration waiting for the school office to verify custody.
class PendingRegistration extends Equatable {
  const PendingRegistration({
    required this.reference,
    required this.request,
    required this.submittedAt,
  });
  final String reference;
  final RegistrationRequest request;
  final DateTime submittedAt;

  @override
  List<Object?> get props => [reference, request, submittedAt];
}
