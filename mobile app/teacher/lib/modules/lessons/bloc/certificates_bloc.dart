import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../repositories/certificate_repository_interface.dart';
import 'certificates_events.dart';
import 'certificates_states.dart';
import 'lessons_notice.dart';

/// Student certificates, templates, the teacher's certifications and the issue/preview flow.
class CertificatesBloc extends Bloc<CertificatesEvent, CertificatesState> {
  CertificatesBloc(this._repo) : super(const CertificatesState()) {
    on<CertificatesLoadRequested>(_onLoad);
    on<PendingCertificatesSigned>(_onSignAll);
    on<CertificateSigned>(_onSign);
    on<CertificateRevoked>(_onRevoke);
    on<CertificateShared>(_onShare);
    on<CertificateDraftSaved>(_onDraft);
    on<CertificateIssued>(_onIssue);
    _sub = _repo.watch().listen((_) => add(const CertificatesLoadRequested()));
  }

  final ICertificateRepository _repo;
  late final StreamSubscription<void> _sub;
  int _n = 0;

  Notice _notice(String m, [NoticeAction a = NoticeAction.none]) => Notice(++_n, m, action: a);

  Future<void> _onLoad(CertificatesLoadRequested e, Emitter<CertificatesState> emit) async {
    if (state.status == CertificatesStatus.initial) emit(state.copyWith(status: CertificatesStatus.loading));
    try {
      emit(state.copyWith(
        status: CertificatesStatus.loaded,
        certificates: await _repo.getCertificates(),
        templates: await _repo.getTemplates(),
        mine: await _repo.getMyCertifications(),
        draft: await _repo.getDraft(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: CertificatesStatus.failure, error: err.message));
    }
  }

  Future<void> _onSignAll(PendingCertificatesSigned e, Emitter<CertificatesState> emit) async {
    final pending = (await _repo.getCertificates()).where((c) => !c.issued).toList();
    for (final c in pending) {
      await _repo.update(c.copyWith(status: 'issued'));
    }
    emit(state.copyWith(notice: _notice('${pending.length} certificates signed & issued')));
  }

  Future<void> _onSign(CertificateSigned e, Emitter<CertificatesState> emit) async {
    final c = state.certificate(e.id);
    if (c == null) return;
    await _repo.update(c.copyWith(status: 'issued', date: todayIso()));
    emit(state.copyWith(notice: _notice('Certificate signed & issued')));
  }

  Future<void> _onRevoke(CertificateRevoked e, Emitter<CertificatesState> emit) async {
    await _repo.revoke(e.id);
    emit(state.copyWith(notice: _notice('Certificate revoked', NoticeAction.pop)));
  }

  Future<void> _onShare(CertificateShared e, Emitter<CertificatesState> emit) async {
    await _repo.logActivity(e.what);
    emit(state.copyWith(notice: _notice('Shared: ${e.what}')));
  }

  Future<void> _onDraft(CertificateDraftSaved e, Emitter<CertificatesState> emit) async {
    await _repo.saveDraft(e.draft);
    emit(state.copyWith(draft: e.draft, notice: _notice('', NoticeAction.openPreview)));
  }

  Future<void> _onIssue(CertificateIssued e, Emitter<CertificatesState> emit) async {
    await _repo.issue(e.cert);
    await _repo.logActivity('Issued "${e.cert.title}" to ${e.cert.student}');
    emit(state.copyWith(notice: _notice('Certificate issued to ${e.cert.student}', NoticeAction.popTwice)));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
