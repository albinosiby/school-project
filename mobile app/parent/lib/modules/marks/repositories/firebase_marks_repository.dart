import '../../../utils/services/firebase/parent_session.dart';
import '../models/marks_models.dart';
import 'marks_repository_interface.dart';

/// `par_results/{studentId}_{paperId}` (published papers only, §13.2), grouped into one result per exam cycle.
class FirebaseMarksRepository implements IMarksRepository {
  FirebaseMarksRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<ExamResult>> watchExams(String childId) =>
      _session.col('par_results').where('studentId', isEqualTo: childId).snapshots().map((q) => group([for (final d in q.docs) d.data()]));

  static List<ExamResult> group(List<Json> papers) {
    final byCycle = <String, List<Json>>{};
    for (final p in papers) {
      (byCycle['${p['cycleId'] ?? p['exam'] ?? ''}'] ??= []).add(p);
    }
    final out = [
      for (final e in byCycle.entries)
        ExamResult(
          id: e.key,
          name: '${e.value.first['exam'] ?? 'Exam'}',
          date: e.value.map((p) => parseDay(p['date'])).whereType<DateTime>().fold<DateTime?>(null, (a, b) => a == null || b.isBefore(a) ? b : a) ??
              DateTime.now(),
          subjects: [
            for (final p in e.value..sort((a, b) => '${a['subject']}'.compareTo('${b['subject']}')))
              SubjectMark(
                subject: '${p['subject'] ?? ''}',
                obtained: (p['obtained'] as num?)?.toDouble() ?? 0,
                max: (p['max'] as num?)?.toDouble() ?? 0,
              ),
          ],
        ),
    ]..sort((a, b) => b.date.compareTo(a.date));
    return out;
  }
}
