import 'package:equatable/equatable.dart';

enum CertificateCategory {
  academic('Academic & Merit'),
  bonafide('Bonafide & Institutional'),
  sports('Sports & Extra');

  const CertificateCategory(this.label);
  final String label;
}

/// Certificate types a parent can request from the school office.
enum CertificateRequestType {
  bonafide('Bonafide Certificate', CertificateCategory.bonafide),
  character('Character Certificate', CertificateCategory.bonafide),
  transfer('Transfer Certificate', CertificateCategory.bonafide),
  feeReceipt('Annual Fee Certificate', CertificateCategory.bonafide);

  const CertificateRequestType(this.label, this.category);
  final String label;
  final CertificateCategory category;
}

/// An issued (or requested) certificate of a child (`certificates` in the data contract).
class Certificate extends Equatable {
  const Certificate({
    required this.id,
    required this.childId,
    required this.title,
    required this.category,
    required this.issuer,
    required this.summary,
    required this.issuedOn,
    required this.tags,
    required this.size,
    required this.signature,
    this.refNo,
    this.validTill,
    this.downloadedAt,
    this.requested = false,
    this.purpose,
  });

  final String id, childId, title, issuer, summary, size, signature;
  final CertificateCategory category;

  /// Issue date (request date while [requested]).
  final DateTime issuedOn;
  final List<String> tags;
  final String? refNo, purpose;
  final DateTime? validTill, downloadedAt;

  /// Requested from the app and still being prepared by the school office.
  final bool requested;

  String get fileName =>
      '${title.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')}.pdf';

  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return title.toLowerCase().contains(q) ||
        summary.toLowerCase().contains(q) ||
        issuer.toLowerCase().contains(q) ||
        (refNo?.toLowerCase().contains(q) ?? false) ||
        id.toLowerCase().contains(q) ||
        tags.any((t) => t.toLowerCase().contains(q));
  }

  Certificate copyWith({DateTime? downloadedAt}) => Certificate(
    id: id,
    childId: childId,
    title: title,
    category: category,
    issuer: issuer,
    summary: summary,
    issuedOn: issuedOn,
    tags: tags,
    size: size,
    signature: signature,
    refNo: refNo,
    validTill: validTill,
    downloadedAt: downloadedAt ?? this.downloadedAt,
    requested: requested,
    purpose: purpose,
  );

  @override
  List<Object?> get props => [
    id,
    childId,
    title,
    category,
    issuer,
    summary,
    issuedOn,
    tags,
    size,
    signature,
    refNo,
    validTill,
    downloadedAt,
    requested,
    purpose,
  ];
}
