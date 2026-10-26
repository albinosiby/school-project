import '../../../utils/services/firebase/parent_session.dart';
import '../models/notice_models.dart';
import 'notice_repository_interface.dart';

/// School notices meant for parents (`com_notices` with `parentVisible`, set by a Cloud Function) for the child's grade.
/// Acknowledging writes `com_notices/{id}/acks/{uid}`; the function counts it on the admin's notice.
class FirebaseNoticeRepository implements INoticeRepository {
  FirebaseNoticeRepository(this._session);
  final ParentSession _session;
  final Set<String> _acked = {};

  @override
  Stream<List<Notice>> watchNotices(String childId) async* {
    final child = await _session.student(childId);
    final grade = '${child['grade'] ?? ''}';
    yield* _session.col('com_notices').where('parentVisible', isEqualTo: true).snapshots().asyncMap((q) async {
      final out = <Notice>[];
      for (final doc in q.docs) {
        final d = doc.data();
        final grades = [for (final g in (d['grades'] as List?) ?? const []) '$g'];
        if (grades.isNotEmpty && grade.isNotEmpty && !grades.contains(grade) && !grades.contains('Grade $grade')) continue;
        final requiresAck = d['requiresAck'] == true || d['urgent'] == true;
        if (requiresAck && !_acked.contains(doc.id)) {
          try {
            if ((await doc.reference.collection('acks').doc(_session.uid).get()).exists) _acked.add(doc.id);
          } catch (_) {} // offline with nothing cached: shown as not acknowledged yet
        }
        out.add(fromDoc(doc.id, d, acknowledged: _acked.contains(doc.id)));
      }
      out.sort((a, b) => b.date.compareTo(a.date));
      return out;
    });
  }

  @override
  Future<void> acknowledge(String noticeId) async {
    await _session.col('com_notices').doc(noticeId).collection('acks').doc(_session.uid).set({
      'at': DateTime.now().toIso8601String(),
      'studentIds': _session.studentIds,
    });
    _acked.add(noticeId);
  }

  static NoticeCategory categoryOf(Json d) {
    if (d['urgent'] == true) return NoticeCategory.urgent;
    final c = '${d['category'] ?? ''}'.toLowerCase();
    if (c.contains('holiday')) return NoticeCategory.holiday;
    if (c.contains('exam') || c.contains('result')) return NoticeCategory.exam;
    if (c.contains('event') || c.contains('sport') || c.contains('celebration')) return NoticeCategory.event;
    return NoticeCategory.general;
  }

  static Notice fromDoc(String id, Json d, {bool acknowledged = false}) => Notice(
        id: id,
        title: '${d['title'] ?? ''}',
        body: '${d['body'] ?? ''}',
        date: parseTime(d['sentAt']) ?? parseTime(d['updatedAt']) ?? DateTime.now(),
        from: '${d['author'] ?? 'School Office'}',
        category: categoryOf(d),
        requiresAck: d['requiresAck'] == true || d['urgent'] == true,
        acknowledged: acknowledged,
      );
}
