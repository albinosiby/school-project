import '../../../utils/services/data_store.dart';
import '../models/marks_models.dart';
import 'marks_repository_interface.dart';

class LocalMarksRepository implements IMarksRepository {
  LocalMarksRepository(this._db);
  final DataStore _db;
  static const exams = 'att_exams', marks = 'att_marks';

  @override
  Future<List<Exam>> getExams() async => [for (final r in _db.list(exams)) Exam.fromJson(r)];

  @override
  Future<List<StudentMark>> getMarks({String? examId}) async =>
      [for (final r in _db.list(marks)) if (examId == null || r['examId'] == examId) StudentMark.fromJson(r)];

  @override
  Future<void> saveMark(StudentMark mark) async {
    final json = mark.toJson();
    if (_db.byId(marks, mark.id) == null) {
      _db.add(marks, json);
    } else {
      _db.update(marks, mark.id, json);
    }
  }

  @override
  Future<void> submitExam(String examId) async => _db.update(exams, examId, {'status': 'Submitted', 'submittedAt': DateTime.now().toIso8601String()});

  @override
  Stream<void> watch() => _db.watch({exams, marks});
}
