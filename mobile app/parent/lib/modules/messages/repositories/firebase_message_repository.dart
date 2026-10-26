import '../../../utils/services/firebase/parent_session.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';

/// Parent ↔ teacher messages (§13.3): `msg_threads/thr_{studentId}_{staffId}` and `msg_messages`.
/// Every query carries `parentUids array-contains uid`, which is what the rules check. A Cloud Function updates the
/// thread's last message and unread counters; the app only resets its own `unreadParent`.
class FirebaseMessageRepository implements IMessageRepository {
  FirebaseMessageRepository(this._session);
  final ParentSession _session;

  @override
  Stream<List<MessageThread>> watchThreads(String childId) => _session
      .col('msg_threads')
      .where('parentUids', arrayContains: _session.uid)
      .where('studentId', isEqualTo: childId)
      .snapshots()
      .map((q) {
        final list = [
          for (final doc in q.docs)
            MessageThread(
              id: doc.id,
              childId: '${doc.data()['studentId'] ?? ''}',
              teacher: '${doc.data()['teacher'] ?? ''}',
              role: '${doc.data()['role'] ?? ''}',
              lastMessage: '${doc.data()['lastMessage'] ?? ''}',
              lastAt: parseTime(doc.data()['lastAt']) ?? DateTime.fromMillisecondsSinceEpoch(0),
              unread: (doc.data()['unreadParent'] as num?)?.toInt() ?? 0,
            ),
        ]..sort((a, b) => b.lastAt.compareTo(a.lastAt));
        return list;
      });

  @override
  Stream<List<ChatMessage>> watchMessages(String threadId) {
    _markRead(threadId);
    return _session
        .col('msg_messages')
        .where('parentUids', arrayContains: _session.uid)
        .where('threadId', isEqualTo: threadId)
        .snapshots()
        .map((q) {
          final list = [
            for (final doc in q.docs)
              ChatMessage(
                id: doc.id,
                threadId: threadId,
                fromParent: doc.data()['from'] == 'parent',
                text: '${doc.data()['text'] ?? ''}',
                at: parseTime(doc.data()['at']) ?? DateTime.now(),
              ),
          ]..sort((a, b) => a.at.compareTo(b.at));
          if (list.isNotEmpty && !list.last.fromParent) _markRead(threadId);
          return list;
        });
  }

  @override
  Future<void> send(String threadId, String text) async {
    final body = text.trim();
    if (body.isEmpty) return;
    final thread = (await _session.col('msg_threads').doc(threadId).get()).data();
    if (thread == null) throw StateError('Conversation not found');
    await _session.col('msg_messages').add({
      'threadId': threadId,
      'studentId': thread['studentId'],
      'teacherId': thread['teacherId'],
      'parentUids': thread['parentUids'],
      'from': 'parent',
      'uid': _session.uid,
      'name': '${_session.user['name'] ?? 'Parent'}',
      'text': body,
      'at': DateTime.now().toIso8601String(),
    });
  }

  /// Opens (or creates) the conversation with [teacherId] about [childId]; returns the thread id.
  Future<String> startThread({required String childId, required String teacherId, required String teacher, String role = ''}) async {
    final id = 'thr_${childId}_$teacherId';
    final ref = _session.col('msg_threads').doc(id);
    final existing = await ref.get().then((s) => s.exists).catchError((_) => false);
    if (existing) return id;
    final child = await _session.student(childId);
    await ref.set({
      'studentId': childId,
      'classId': '${child['classId'] ?? ''}',
      'studentName': '${child['name'] ?? ''}',
      // every linked guardian of the child sees the conversation
      'parentUids': {_session.uid, ...[for (final u in (child['guardianUids'] as List?) ?? const []) '$u']}.toList(),
      'guardian': '${_session.user['name'] ?? child['guardian'] ?? ''}',
      'teacherId': teacherId,
      'teacher': teacher,
      'role': role,
      'lastMessage': '',
      'lastAt': DateTime.now().toIso8601String(),
      'lastFrom': 'parent',
      'unreadParent': 0,
      'unreadTeacher': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
    return id;
  }

  void _markRead(String threadId) {
    _session.col('msg_threads').doc(threadId).update({'unreadParent': 0}).catchError((_) {});
  }
}
