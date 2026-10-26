import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../repositories/student_repository_interface.dart';
import 'student_events.dart';
import 'student_states.dart';

/// Download (simulated) and request certificates. Validation lives here.
class CertificateActionBloc
    extends Bloc<CertificateActionEvent, CertificateActionState> {
  CertificateActionBloc(this._repo) : super(const CertificateActionState()) {
    on<DownloadCertificate>(_download);
    on<RequestCertificate>(_request);
    on<ResetCertificateAction>(
      (_, emit) => emit(const CertificateActionState()),
    );
  }

  final IStudentRepository _repo;
  static const minPurpose = 5;

  Future<void> _download(
    DownloadCertificate e,
    Emitter<CertificateActionState> emit,
  ) async {
    emit(
      const CertificateActionState(
        status: CertificateActionStatus.submitting,
        action: CertificateAction.download,
      ),
    );
    try {
      final c = await _repo.recordDownload(
        childId: e.childId,
        certificateId: e.certificateId,
      );
      emit(
        CertificateActionState(
          status: CertificateActionStatus.success,
          action: CertificateAction.download,
          certificate: c,
        ),
      );
    } catch (err) {
      emit(
        CertificateActionState(
          status: CertificateActionStatus.failure,
          action: CertificateAction.download,
          error: errorMessage(err),
        ),
      );
    }
  }

  Future<void> _request(
    RequestCertificate e,
    Emitter<CertificateActionState> emit,
  ) async {
    final errors = <String, String>{
      if (e.type == null) 'type': 'Choose the certificate you need.',
      if (e.purpose.trim().length < minPurpose)
        'purpose':
            'Tell the office what it is for (at least $minPurpose characters).',
    };
    if (errors.isNotEmpty)
      return emit(
        CertificateActionState(
          status: CertificateActionStatus.failure,
          action: CertificateAction.request,
          errors: errors,
        ),
      );
    emit(
      const CertificateActionState(
        status: CertificateActionStatus.submitting,
        action: CertificateAction.request,
      ),
    );
    try {
      final c = await _repo.requestCertificate(
        childId: e.childId,
        type: e.type!,
        purpose: e.purpose,
      );
      emit(
        CertificateActionState(
          status: CertificateActionStatus.success,
          action: CertificateAction.request,
          certificate: c,
        ),
      );
    } catch (err) {
      emit(
        CertificateActionState(
          status: CertificateActionStatus.failure,
          action: CertificateAction.request,
          error: errorMessage(err),
        ),
      );
    }
  }
}
