import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart';
import '../models/certificate_models.dart';
import '../models/student_models.dart';

typedef StudentProfileState = DataState<StudentProfile>;
typedef CertificatesState = DataState<List<Certificate>>;

enum CertificateAction { download, request }

enum CertificateActionStatus { idle, submitting, success, failure }

class CertificateActionState extends Equatable {
  const CertificateActionState({
    this.status = CertificateActionStatus.idle,
    this.action,
    this.errors = const {},
    this.error,
    this.certificate,
  });
  final CertificateActionStatus status;
  final CertificateAction? action;

  /// Inline field errors of the request form: `type`, `purpose`.
  final Map<String, String> errors;
  final String? error;
  final Certificate? certificate;

  bool get submitting => status == CertificateActionStatus.submitting;

  @override
  List<Object?> get props => [status, action, errors, error, certificate];
}
