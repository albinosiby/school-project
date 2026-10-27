import 'package:equatable/equatable.dart';
import '../models/certificate_models.dart';

export '../../../core/bloc/child_data_bloc.dart'
    show ChildDataEvent, LoadChildData, RefreshChildData;

/// Writes on certificates (handled by [CertificateActionBloc]).
sealed class CertificateActionEvent extends Equatable {
  const CertificateActionEvent();
  @override
  List<Object?> get props => [];
}

class DownloadCertificate extends CertificateActionEvent {
  const DownloadCertificate({
    required this.childId,
    required this.certificateId,
  });
  final String childId, certificateId;
  @override
  List<Object?> get props => [childId, certificateId];
}

class RequestCertificate extends CertificateActionEvent {
  const RequestCertificate({
    required this.childId,
    this.type,
    this.purpose = '',
  });
  final String childId;
  final CertificateRequestType? type;
  final String purpose;
  @override
  List<Object?> get props => [childId, type, purpose];
}

class ResetCertificateAction extends CertificateActionEvent {
  const ResetCertificateAction();
}
