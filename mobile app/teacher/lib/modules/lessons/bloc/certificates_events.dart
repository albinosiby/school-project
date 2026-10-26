import 'package:equatable/equatable.dart';
import '../models/certificate_models.dart';

sealed class CertificatesEvent extends Equatable {
  const CertificatesEvent();
  @override
  List<Object?> get props => [];
}

class CertificatesLoadRequested extends CertificatesEvent {
  const CertificatesLoadRequested();
}

/// Signs and issues every pending certificate.
class PendingCertificatesSigned extends CertificatesEvent {
  const PendingCertificatesSigned();
}

/// Signs and issues one certificate (dated today).
class CertificateSigned extends CertificatesEvent {
  const CertificateSigned(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class CertificateRevoked extends CertificatesEvent {
  const CertificateRevoked(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

/// Logs a share of [what] to the activity feed.
class CertificateShared extends CertificatesEvent {
  const CertificateShared(this.what);
  final String what;
  @override
  List<Object?> get props => [what];
}

/// Stores the composed certificate and opens the preview.
class CertificateDraftSaved extends CertificatesEvent {
  const CertificateDraftSaved(this.draft);
  final CertificateDraft draft;
  @override
  List<Object?> get props => [draft];
}

/// Issues [cert] (built from the draft on the preview screen).
class CertificateIssued extends CertificatesEvent {
  const CertificateIssued(this.cert);
  final StudentCertificate cert;
  @override
  List<Object?> get props => [cert];
}
