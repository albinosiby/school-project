import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../config/app_config.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/marks_models.dart';
import 'marks_repository_interface.dart';

/// `par_results/{studentId}_{paperId}` (published papers only, §13.2), grouped into one result per exam cycle.
class FirebaseMarksRepository implements IMarksRepository, PublishedReportRepository {
  FirebaseMarksRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<ExamResult>> watchExams(String childId) => _session.whenReady(() {
    late StreamController<List<ExamResult>> controller;
    StreamSubscription? subjects, reports;
    List<Json>? subjectRows, reportRows;
    void emit() {
      if (subjectRows == null || reportRows == null || controller.isClosed) return;
      controller.add(mergePublished(subjectRows!, reportRows!));
    }
    controller = StreamController<List<ExamResult>>(
      onListen: () {
        subjects = _session.col('par_results').where('studentId', isEqualTo: childId).snapshots().listen((q) {
          subjectRows = [for (final d in q.docs) d.data()]; emit();
        }, onError: controller.addError);
        reports = _session.col('exm_report_cards').where('studentId', isEqualTo: childId).where('status', isEqualTo: 'Published').snapshots().listen((q) {
          reportRows = [for (final d in q.docs) d.data()]; emit();
        }, onError: controller.addError);
      },
      onCancel: () async { await subjects?.cancel(); await reports?.cancel(); },
    );
    return controller.stream;
  });

  static List<ExamResult> mergePublished(List<Json> subjects, List<Json> reports) {
    final byCycle = {for (final exam in group(subjects)) exam.id: exam};
    final newest = <String, Json>{};
    for (final report in reports) {
      final cycle = '${report['cycleId'] ?? ''}';
      if (report['status'] != 'Published' || cycle.isEmpty) continue;
      if (newest[cycle] == null || '${report['publishedAt']}'.compareTo('${newest[cycle]!['publishedAt']}') > 0) newest[cycle] = report;
    }
    for (final e in newest.entries) {
      final report = e.value, rules = report['resultRules'] as Map?;
      byCycle[e.key] = ExamResult(
        id: e.key, name: '${report['exam'] ?? 'Exam'}', date: parseDay(report['date']) ?? DateTime.fromMillisecondsSinceEpoch(0),
        reportBatchId: '${report['batchId']}', rank: report['rank'] as int?,
        remarks: (report['remarks'] as Map?)?['classTeacher'] as String?,
        calculation: '${rules?['calculation'] ?? 'total'}', rounding: '${rules?['rounding'] ?? 'none'}', absentRule: '${rules?['absentRule'] ?? 'incomplete'}', gradingScale: '${report['scale'] ?? ''}',
        subjects: [for (final entry in report['entries'] as List? ?? []) _snapshotSubject(entry as Map)],
      );
    }
    return byCycle.values.toList()..sort((a, b) => b.date.compareTo(a.date));
  }

  static SubjectMark _snapshotSubject(Map entry) {
    final paper = entry['paper'] as Map, mark = entry['mark'] as Map, result = entry['result'] as Map;
    return SubjectMark(subject: '${paper['subject']}', obtained: (result['total'] as num?)?.toDouble() ?? 0,
      max: ((paper['theory'] as num?) ?? 0).toDouble() + ((paper['internal'] as num?) ?? 0).toDouble() + ((paper['practical'] as num?) ?? 0).toDouble(),
      recordedGrade: result['grade'] as String?, assessmentMode: '${paper['assessmentMode'] ?? 'marks'}', status: '${mark['status'] ?? 'Present'}',
      weight: (paper['weight'] as num?)?.toDouble() ?? 1, incomplete: result['state'] == 'pending' || result['state'] == 'invalid' || result['state'] == 'medical');
  }

  @override
  Future<String> reportLink(String childId, String batchId) async {
    final token = await _session.auth.currentUser?.getIdToken();
    if (token == null) throw AppException(message: 'Sign in to download the report.');
    final project = _session.auth.app.options.projectId;
    var host = AppConfig.emulatorHost;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android && !AppConfig.emulatorUsb && (host == 'localhost' || host == '127.0.0.1')) host = '10.0.2.2';
    final url = AppConfig.useEmulator ? Uri(scheme: 'http', host: host, port: 5001, path: '/$project/asia-south1/downloadExamReport') : Uri.https('asia-south1-$project.cloudfunctions.net', '/downloadExamReport');
    final response = await http.post(url, headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'data': {'schoolId': _session.schoolId, 'batchId': batchId, 'studentId': childId, 'linkOnly': true}})).timeout(const Duration(seconds: 60));
    final body = jsonDecode(response.body) as Map;
    final result = body['result'] as Map?;
    if (response.statusCode != 200 || result?['url'] is! String) throw AppException(message: '${(body['error'] as Map?)?['message'] ?? 'Could not open the published report.'}');
    final link = result!['url'] as String;
    return AppConfig.useEmulator ? link.replaceFirst('://127.0.0.1:', '://$host:').replaceFirst('://localhost:', '://$host:') : link;
  }

  static List<ExamResult> group(List<Json> papers) {
    final byCycle = <String, List<Json>>{};
    for (final p in papers) {
      (byCycle['${p['cycleId'] ?? p['exam'] ?? ''}'] ??= []).add(p);
    }
    final out = [
      for (final e in byCycle.entries)
        ExamResult(
          id: e.key,
          expectedSubjects: e.value.fold<int>(0, (count, p) => ((p['expectedPapers'] as num?)?.toInt() ?? 0) > count ? (p['expectedPapers'] as num).toInt() : count),
          name: '${e.value.first['exam'] ?? 'Exam'}',
          date: e.value.map((p) => parseDay(p['date'])).whereType<DateTime>().fold<DateTime?>(null, (a, b) => a == null || b.isBefore(a) ? b : a) ??
              DateTime.now(),
          calculation: '${(e.value.first['resultRules'] as Map?)?['calculation'] ?? 'total'}',
          rounding: '${(e.value.first['resultRules'] as Map?)?['rounding'] ?? 'none'}',
          absentRule: '${(e.value.first['resultRules'] as Map?)?['absentRule'] ?? 'incomplete'}',
          gradingScale: '${e.value.first['scale'] ?? ''}',
          subjects: [
            for (final p in e.value..sort((a, b) => '${a['subject']}'.compareTo('${b['subject']}')))
              SubjectMark(
                subject: '${p['subject'] ?? ''}',
                obtained: (p['obtained'] as num?)?.toDouble() ?? 0,
                max: (p['max'] as num?)?.toDouble() ?? 0,
                recordedGrade: p['grade'] as String?,
                assessmentMode: '${p['assessmentMode'] ?? 'marks'}',
                status: '${p['status'] ?? 'Present'}',
                weight: (p['weight'] as num?)?.toDouble() ?? 1,
                incomplete: p['obtained'] == null && p['assessmentMode'] != 'grade',
              ),
          ],
        ),
    ]..sort((a, b) => b.date.compareTo(a.date));
    return out;
  }
}
