import '../../../utils/services/firebase/parent_session.dart';
import '../models/live_class_models.dart';
import 'live_class_repository_interface.dart';

/// The child's class sessions from `live_classes` (§6). Join taps write `live_classes/{id}/joins/{uid}`.
class FirebaseLiveClassRepository implements ILiveClassRepository {
  FirebaseLiveClassRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<LiveClass>> watchLiveClasses(String childId) async* {
    final classId = await _session.classIdOf(childId);
    if (classId.isEmpty) {
      yield const [];
      return;
    }
    yield* _session.col('live_classes').where('classId', isEqualTo: classId).snapshots().map((q) {
      final out = <LiveClass>[];
      for (final doc in q.docs) {
        final d = doc.data();
        final status = '${d['status'] ?? ''}'.toLowerCase();
        if (status == 'draft' || status == 'cancelled' || d['deleted'] == true) continue;
        final start = parseDay(d['date'], d['time']);
        if (start == null || '${d['link'] ?? ''}'.isEmpty) continue;
        out.add(LiveClass(
          id: doc.id,
          title: '${d['title'] ?? d['subject'] ?? 'Live class'}',
          subject: '${d['subject'] ?? ''}',
          teacher: '${d['teacher'] ?? d['teacherName'] ?? ''}',
          start: start,
          mins: (d['mins'] as num?)?.toInt() ?? 40,
          link: '${d['link']}',
        ));
      }
      out.sort((a, b) => a.start.compareTo(b.start));
      return out;
    });
  }

  @override
  Future<void> recordJoin(String classId) => _session.col('live_classes').doc(classId).collection('joins').doc(_session.uid).set({
        'joinedAt': DateTime.now().toIso8601String(),
        'role': 'parent',
        'studentIds': _session.studentIds,
      });
}
