import '../models/classes_models.dart';

/// A student's document vault and the document requests sent to their guardians.
abstract class IDocumentsRepository {
  Future<List<StudentDocument>> getDocuments(String studentId);
  Future<List<DocumentRequest>> getRequests(String studentId, {String status = 'pending'});
  Future<DocumentRequest> addRequest(DocumentRequest request);
  /// Marks the request received and files the document in the vault.
  Future<void> markReceived(DocumentRequest request);
  Future<void> cancelRequest(String id);
  Stream<void> watch();
}
