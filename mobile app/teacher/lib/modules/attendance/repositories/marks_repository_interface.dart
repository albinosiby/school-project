import '../models/marks_models.dart';

/// Exams and per-student marks.
abstract class IMarksRepository {
  Future<List<Exam>> getExams();
  Future<List<StudentMark>> getMarks({String? examId});
  /// Inserts or replaces the mark with id `${examId}_$studentId`.
  Future<void> saveMark(StudentMark mark);
  Future<void> submitExam(String examId);
  Stream<void> watch();
}
