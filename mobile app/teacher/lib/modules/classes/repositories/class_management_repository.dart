import '../../../utils/services/data_store.dart';
import '../models/class_management_models.dart';
import 'class_management_repository_interface.dart';

/// `ct_periods` / `ct_marks` (filled for the class teacher's division in Firebase mode). Without them (local demo)
/// the teacher's own timetable periods and mark entries stand in.
class LocalClassManagementRepository implements IClassManagementRepository {
  LocalClassManagementRepository(this._db);
  final DataStore _db;

  @override
  Future<List<ClassPeriod>> getTimetable(String classId) async {
    final rows = [for (final r in _db.list('ct_periods')) if (r['classId'] == classId) ClassPeriod.fromJson(r)];
    if (rows.isNotEmpty) return rows;
    return [
      for (final p in _db.list('tt_periods'))
        if (p['classId'] == classId)
          ClassPeriod(
            classId: classId,
            day: (p['day'] as num?)?.toInt() ?? 0,
            period: int.tryParse('${p['slot'] ?? ''}'.replaceAll(RegExp(r'\D'), '')) ?? 0,
            subject: '${p['subject'] ?? ''}',
          ),
    ];
  }

  @override
  Future<List<ClassMark>> getMarks(String classId) async {
    final rows = [for (final r in _db.list('ct_marks')) if (r['classId'] == classId) ClassMark.fromJson(r)];
    if (rows.isNotEmpty) return rows;
    final exams = {for (final e in _db.list('att_exams')) if (e['classId'] == classId) '${e['id']}': e};
    return [
      for (final m in _db.list('att_marks'))
        if (exams.containsKey(m['examId']))
          () {
            final e = exams[m['examId']]!;
            final hasScore = m['marks'] != null || m['practical'] != null || m['internal'] != null;
            int n(Object? v) => (v as num?)?.toInt() ?? 0;
            return ClassMark(
              studentId: '${m['studentId']}',
              subject: '${e['subject'] ?? ''}',
              exam: '${e['name'] ?? 'Exam'}',
              cycleId: '${e['name'] ?? ''}',
              paperId: '${e['id']}',
              score: hasScore ? n(m['marks']) + n(m['practical']) + n(m['internal']) : null,
              max: n(e['max']),
              grade: '${m['gradeValue'] ?? ''}',
              status: '${m['status'] ?? 'Present'}',
            );
          }(),
    ];
  }

  @override
  Stream<void> watch() => _db.watch({'ct_periods', 'ct_marks', 'tt_periods', 'att_marks', 'att_exams'});
}
