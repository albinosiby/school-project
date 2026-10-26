import '../models/exam_duty_models.dart';

/// Exam invigilation duties and the candidates seated in each hall.
abstract class IExamDutyRepository {
  Future<List<ExamDuty>> getAll();
  Future<ExamDuty?> get(String id);
  Future<void> setChecklist(String id, List<int> checked);
  Future<void> requestSwap(String id, {required String withWhom, required String reason});
  Future<void> cancelSwap(String id);
  Future<void> submitFinalList(String id);

  Future<List<Candidate>> getCandidates(String dutyId);
  Future<Candidate?> getCandidate(String id);
  Future<void> markCandidate(String id, {required bool present});

  /// Sets the number of supplementary sheets issued (a new sheet code is assigned when it grows).
  Future<void> setSupplementary(String id, int count);
  Future<void> saveIncidentNote(String id, String note);
  Stream<void> watch();
}
