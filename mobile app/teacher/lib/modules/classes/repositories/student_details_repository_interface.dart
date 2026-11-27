import '../models/student_details.dart';

/// The class teacher's view of a student's full record (contacts, address, medical, admission) and her corrections.
abstract class IStudentDetailsRepository {
  /// The cached copy (when this session already loaded it), then the server's. Errors only when nothing is cached.
  Stream<StudentDetails> watch(String studentId);

  /// Saves the class teacher's changes and returns the record as stored.
  Future<StudentDetails> update(String studentId, StudentDetailsPatch patch);
}
