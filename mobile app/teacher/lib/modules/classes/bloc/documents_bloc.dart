import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/documents_repository_interface.dart';
import 'documents_events.dart';
import 'documents_states.dart';

/// Student Documents screen and Request Document sheet.
class DocumentsBloc extends Bloc<DocumentsEvent, DocumentsState> {
  DocumentsBloc(this._repo) : super(const DocumentsState()) {
    on<DocumentsLoadRequested>(_onLoad);
    on<DocumentRequested>(_onRequest);
    on<DocumentRequestReceived>(_onReceived);
    on<DocumentRequestCancelled>(_onCancel);
    _sub = _repo.watch().listen((_) {
      if (state.studentId.isNotEmpty) add(DocumentsLoadRequested(state.studentId));
    });
  }

  final IDocumentsRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(DocumentsLoadRequested e, Emitter<DocumentsState> emit) async {
    if (state.status == DocumentsStatus.initial) emit(state.copyWith(status: DocumentsStatus.loading, studentId: e.studentId));
    try {
      emit(state.copyWith(
        status: DocumentsStatus.loaded, studentId: e.studentId,
        documents: await _repo.getDocuments(e.studentId), requests: await _repo.getRequests(e.studentId),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: DocumentsStatus.failure, error: err.message));
    }
  }

  Future<void> _onRequest(DocumentRequested e, Emitter<DocumentsState> emit) async {
    final r = await _repo.addRequest(e.request);
    emit(state.copyWith(
      requests: [r, ...state.requests.where((x) => x.id != r.id)],
      notice: 'Request for ${r.doc} sent${r.notify ? ' via WhatsApp & SMS' : ''}', bumpNotice: true,
    ));
  }

  Future<void> _onReceived(DocumentRequestReceived e, Emitter<DocumentsState> emit) async {
    await _repo.markReceived(e.request);
    emit(state.copyWith(notice: '${e.request.doc} received', bumpNotice: true));
  }

  Future<void> _onCancel(DocumentRequestCancelled e, Emitter<DocumentsState> emit) async {
    await _repo.cancelRequest(e.id);
    emit(state.copyWith(requests: state.requests.where((r) => r.id != e.id).toList(), notice: 'Request cancelled', bumpNotice: true));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
