import '../../../utils/services/data_store.dart';
import '../models/classes_models.dart';
import 'documents_repository_interface.dart';

class LocalDocumentsRepository implements IDocumentsRepository {
  LocalDocumentsRepository(this._db);
  final DataStore _db;
  static const _docs = 'cl_documents', _reqs = 'cl_doc_requests';

  @override
  Future<List<StudentDocument>> getDocuments(String studentId) async =>
      [for (final r in _db.list(_docs)) if (r['studentId'] == studentId) StudentDocument.fromJson(r)];

  @override
  Future<List<DocumentRequest>> getRequests(String studentId, {String status = 'pending'}) async =>
      [for (final r in _db.list(_reqs)) if (r['studentId'] == studentId && r['status'] == status) DocumentRequest.fromJson(r)];

  @override
  Future<DocumentRequest> addRequest(DocumentRequest request) async => DocumentRequest.fromJson(_db.add(_reqs, request.toJson()));

  @override
  Future<void> markReceived(DocumentRequest request) async {
    _db.update(_reqs, request.id, {'status': 'received'});
    _db.add(_docs, StudentDocument(studentId: request.studentId, group: 'KYC & Board Records', title: request.doc, meta: 'PDF • Received just now', tag: 'RECEIVED').toJson());
  }

  @override
  Future<void> cancelRequest(String id) async => _db.remove(_reqs, id);

  @override
  Stream<void> watch() => _db.watch({_docs, _reqs});
}
