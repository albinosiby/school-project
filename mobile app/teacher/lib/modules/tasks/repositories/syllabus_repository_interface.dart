import '../models/syllabus_models.dart';

/// Syllabus progress log: per-division topic progress (`tk_syllabus`) and its VP submission (`tk_syllabus_meta`).
abstract class ISyllabusRepository {
  Future<List<SyllabusDivision>> getDivisions();
  Future<SyllabusMeta> getMeta();
  /// Logs one taught period for topic [topicIndex] of division [divisionId]; false when the topic is already complete.
  Future<bool> logPeriod(String divisionId, int topicIndex);
  /// Submits the log to the VP, or withdraws the submission.
  Future<void> setSubmitted(bool submitted);
  Stream<void> watch();
}
