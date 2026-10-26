import 'package:equatable/equatable.dart';
import '../models/certificate_models.dart';
import 'lessons_notice.dart';

enum CertificatesStatus { initial, loading, loaded, failure }

class CertificatesState extends Equatable {
  const CertificatesState({
    this.status = CertificatesStatus.initial, this.certificates = const [], this.templates = const [], this.mine = const [], this.draft, this.notice, this.error,
  });
  final CertificatesStatus status;
  final List<StudentCertificate> certificates;
  final List<CertTemplate> templates;
  final List<MyCertification> mine;
  final CertificateDraft? draft;
  final Notice? notice;
  final String? error;

  bool get loaded => status == CertificatesStatus.loaded;
  StudentCertificate? certificate(String id) => certificates.where((c) => c.id == id).firstOrNull;
  CertTemplate? template(String id) => templates.where((t) => t.id == id).firstOrNull;
  int get pendingCount => certificates.where((c) => !c.issued).length;

  /// Verification code the next issued certificate gets.
  String get nextCode => 'DPS-2024-CERT-${8800 + certificates.length * 7 + 41}';

  CertificatesState copyWith({
    CertificatesStatus? status, List<StudentCertificate>? certificates, List<CertTemplate>? templates, List<MyCertification>? mine,
    CertificateDraft? draft, Notice? notice, String? error,
  }) =>
      CertificatesState(
        status: status ?? this.status, certificates: certificates ?? this.certificates, templates: templates ?? this.templates, mine: mine ?? this.mine,
        draft: draft ?? this.draft, notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, certificates, templates, mine, draft, notice, error];
}
