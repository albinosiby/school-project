import '../models/marks_models.dart';

abstract class IMarksRepository {
  /// Cache-first: emits the cached value (if any), then the fresh value.
  Stream<List<ExamResult>> watchExams(String childId);
}

abstract class PublishedReportRepository {
  Future<String> reportLink(String childId, String batchId);
}
