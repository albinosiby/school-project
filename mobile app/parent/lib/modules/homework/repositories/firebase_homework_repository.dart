import 'dart:io';
import 'dart:typed_data';
import 'package:firebase_storage/firebase_storage.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/homework_models.dart';
import 'homework_repository_interface.dart';

/// `par_homework/{studentId}_{homeworkId}`: the class homework plus this child's submission (§13.2).
/// Hand-ins: files to Storage `schools/{sid}/homework/{homeworkId}/{studentId}/…`, then
/// `par_hw_submissions/{studentId}_{homeworkId}`; a Cloud Function copies it onto the homework and `submission`.
class FirebaseHomeworkRepository implements IHomeworkRepository {
  FirebaseHomeworkRepository(this._session, {FirebaseStorage? storage}) : _storageOverride = storage;
  final ParentSession _session;
  final FirebaseStorage? _storageOverride;
  FirebaseStorage get _storage => _storageOverride ?? FirebaseStorage.instance;

  @override
  Stream<List<Homework>> watchHomework(String childId) =>
      _session.col('par_homework').where('studentId', isEqualTo: childId).snapshots().map((q) {
        final list = [for (final d in q.docs) fromDoc(d.data())]..sort((a, b) => b.due.compareTo(a.due));
        return list;
      });

  @override
  Future<void> submit({
    required String childId,
    required String homeworkId,
    required List<PickedHandin> files,
    String note = '',
  }) async {
    final problem = handinProblem(files, note);
    if (problem != null) throw AppException(message: problem);
    final sid = _session.schoolId;
    if (sid.isEmpty || _session.uid.isEmpty) throw AppException(message: 'Sign in again to hand in homework.');
    final uploaded = <Map<String, dynamic>>[];
    try {
      for (final f in files) {
        final mime = PickedHandin.mimeOf(f.name) ?? f.mime;
        final path = 'schools/$sid/homework/$homeworkId/$childId/${DateTime.now().millisecondsSinceEpoch}_${safeHandinName(f.name)}';
        final ref = _storage.ref(path);
        final meta = SettableMetadata(contentType: mime);
        if (f.bytes != null) {
          await ref.putData(Uint8List.fromList(f.bytes!), meta);
        } else if (f.path != null) {
          await ref.putFile(File(f.path!), meta);
        } else {
          throw AppException(message: '${f.name} could not be read.');
        }
        uploaded.add({'name': f.name, 'url': await ref.getDownloadURL(), 'path': path, 'type': mime, 'size': f.size});
      }
    } on AppException {
      rethrow;
    } on FirebaseException catch (e) {
      throw AppException(
        message: e.code == 'unauthorized' ? 'This homework no longer accepts hand-ins.' : 'Upload failed. Check your connection and try again.',
      );
    }
    final now = nowUtc();
    try {
      await _session.col('par_hw_submissions').doc('${childId}_$homeworkId').set({
        'studentId': childId,
        'homeworkId': homeworkId,
        'uid': _session.uid,
        'files': uploaded,
        'note': note.trim(),
        'submittedAt': now,
        'updatedAt': now,
      });
    } on FirebaseException catch (e) {
      throw AppException(
        message: e.code == 'permission-denied' ? 'This homework no longer accepts hand-ins.' : 'Could not hand in. Try again.',
      );
    }
  }

  static bool _isOpen(Object? status) => !const {'closed', 'completed'}.contains('${status ?? ''}'.toLowerCase());

  static Homework fromDoc(Json d) {
    final sub = d['submission'] is Map ? Map<String, dynamic>.from(d['submission'] as Map) : const <String, dynamic>{};
    final status = '${sub['status'] ?? ''}'.toLowerCase();
    final graded = status == 'graded' || status == 'reviewed' || sub['gradedAt'] != null;
    final marks = sub['marks'], max = d['maxMarks'];
    final due = parseDay(d['due']) ?? DateTime.now();
    return Homework(
      id: '${d['homeworkId'] ?? ''}',
      studentId: '${d['studentId'] ?? ''}',
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
      open: _isOpen(d['status']),
      maxMarks: max is num ? max : null,
      files: [
        for (final f in (sub['files'] as List?) ?? const [])
          if (f is Map) HandinFile.fromJson(Map<String, dynamic>.from(f)),
      ],
      note: '${sub['note'] ?? ''}',
      submittedAt: parseTime(sub['submittedAt']),
      late: sub['late'] == true || status == 'late',
    );
  }
}
