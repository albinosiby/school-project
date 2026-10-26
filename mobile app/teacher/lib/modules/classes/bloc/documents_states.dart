import 'package:equatable/equatable.dart';
import '../models/classes_models.dart';

enum DocumentsStatus { initial, loading, loaded, failure }

class DocumentsState extends Equatable {
  const DocumentsState({this.status = DocumentsStatus.initial, this.studentId = '', this.documents = const [], this.requests = const [], this.notice, this.noticeSeq = 0, this.error});
  final DocumentsStatus status;
  final String studentId;
  final List<StudentDocument> documents;
  /// Pending requests only.
  final List<DocumentRequest> requests;
  final String? notice;
  final int noticeSeq;
  final String? error;

  int count(String group) => documents.where((d) => d.group == group).length;

  DocumentsState copyWith({DocumentsStatus? status, String? studentId, List<StudentDocument>? documents, List<DocumentRequest>? requests, String? notice, bool bumpNotice = false, String? error}) => DocumentsState(
        status: status ?? this.status, studentId: studentId ?? this.studentId, documents: documents ?? this.documents, requests: requests ?? this.requests,
        notice: bumpNotice ? notice : this.notice, noticeSeq: bumpNotice ? noticeSeq + 1 : noticeSeq, error: error,
      );

  @override
  List<Object?> get props => [status, studentId, documents, requests, notice, noticeSeq, error];
}
