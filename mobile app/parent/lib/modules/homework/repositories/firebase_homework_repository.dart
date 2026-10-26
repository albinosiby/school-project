import '../../../utils/services/firebase/parent_session.dart';
import '../models/homework_models.dart';
import 'homework_repository_interface.dart';

/// `par_homework/{studentId}_{homeworkId}`: the class homework plus this child's submission (§13.2).
class FirebaseHomeworkRepository implements IHomeworkRepository {
  FirebaseHomeworkRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<Homework>> watchHomework(String childId) =>
      _session.col('par_homework').where('studentId', isEqualTo: childId).snapshots().map((q) {
        final list = [for (final d in q.docs) fromDoc(d.data())]..sort((a, b) => b.due.compareTo(a.due));
        return list;
      });

  static Homework fromDoc(Json d) {
    final sub = d['submission'] is Map ? Map<String, dynamic>.from(d['submission'] as Map) : const <String, dynamic>{};
    final status = '${sub['status'] ?? ''}'.toLowerCase();
    final graded = status == 'graded' || status == 'reviewed' || sub['gradedAt'] != null;
    final marks = sub['marks'], max = d['maxMarks'];
    final due = parseDay(d['due']) ?? DateTime.now();
    return Homework(
      id: '${d['homeworkId'] ?? ''}',
      subject: '${d['subject'] ?? ''}',
      title: '${d['title'] ?? ''}',
      description: '${d['description'] ?? ''}',
      assignedOn: parseDay(d['assigned']) ?? parseTime(d['createdAt']) ?? due,
      due: due,
      teacher: '${d['teacher'] ?? ''}',
      submitted: graded || status == 'submitted' || status == 'late',
      reviewed: graded,
      attachments: [for (final a in (d['attachments'] as List?) ?? const []) a is Map ? '${a['name'] ?? a['url'] ?? ''}' : '$a'],
      remark: '${sub['feedback'] ?? ''}'.isEmpty ? null : '${sub['feedback']}',
      score: marks == null ? null : (max == null ? '$marks' : '$marks/$max'),
    );
  }
}
