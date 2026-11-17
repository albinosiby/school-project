import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/modules/marks/models/marks_models.dart';
import 'package:parent_app/modules/marks/repositories/firebase_marks_repository.dart';

void main() {
  test('published consolidated snapshots override subject projections using the newest version', () {
    final entry = {'paper': {'subject': 'English', 'theory': 80, 'internal': 20, 'practical': 0, 'weight': 2}, 'mark': {'status': 'Present'}, 'result': {'total': 75, 'grade': 'B1', 'state': 'verified'}};
    final report = <String, dynamic>{'cycleId': 'c1', 'exam': 'Term 1', 'batchId': 'new', 'date': '2026-12-10', 'status': 'Published', 'publishedAt': '2026-12-11', 'entries': [entry], 'resultRules': {'calculation': 'weighted'}, 'scale': 'CBSE'};
    final result = FirebaseMarksRepository.mergePublished([{'cycleId': 'c1', 'exam': 'Old projection', 'subject': 'English', 'obtained': 1, 'max': 100}], [
      {...report, 'batchId': 'old', 'publishedAt': '2026-12-10'}, report,
      {...report, 'batchId': 'preview', 'status': 'Preview', 'publishedAt': '2026-12-12'},
    ]).single;
    expect(result.reportBatchId, 'new'); expect(result.obtained, 75); expect(result.subjects.single.weight, 2);
    expect(result.calculation, 'weighted'); expect(result.subjects.single.grade, 'B1');
  });
  const subjects = [SubjectMark(subject: 'English', obtained: 80, max: 100, weight: 3), SubjectMark(subject: 'Maths', obtained: 20, max: 50)];
  test('school result methods apply total, average and weighted calculations', () {
    final date = DateTime(2026);
    expect(ExamResult(id: 'a', name: 'Term', date: date, subjects: subjects, rounding: 'one-decimal').percent, 66.7);
    expect(ExamResult(id: 'a', name: 'Term', date: date, subjects: subjects, calculation: 'average').percent, 60);
    expect(ExamResult(id: 'a', name: 'Term', date: date, subjects: subjects, calculation: 'weighted').percent, 70);
  });
  test('grade-only and exempt subjects do not dilute numeric results', () {
    const descriptor = SubjectMark(subject: 'Art', obtained: 0, max: 0, assessmentMode: 'grade', recordedGrade: 'Secure');
    final result = ExamResult(id: 'a', name: 'Term', date: DateTime(2026), subjects: [subjects.first, descriptor, const SubjectMark(subject: 'PE', obtained: 0, max: 100, status: 'Exempt')]);
    expect(result.percent, 80);
    expect(descriptor.grade, 'Secure');
  });
  test('missing marks remain incomplete and keep the school grade', () {
    final result = ExamResult(id: 'a', name: 'Term', date: DateTime(2026), subjects: const [SubjectMark(subject: 'English', obtained: 0, max: 100, incomplete: true)]);
    expect(result.complete, isFalse);
    expect(result.grade, '--');
  });
}
