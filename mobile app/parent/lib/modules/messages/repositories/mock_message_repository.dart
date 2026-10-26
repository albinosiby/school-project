import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';

class MockMessageRepository implements IMessageRepository {
  MockMessageRepository(this._cache);
  final CacheService _cache;
  final Map<String, List<ChatMessage>> _sent = {};
  final _changes = StreamController<void>.broadcast();

  List<ChatMessage> _chat(String threadId) =>
      [...DemoData.chat(threadId), ...?_sent[threadId]]
        ..sort((a, b) => a.at.compareTo(b.at));

  @override
  Stream<List<MessageThread>> watchThreads(String childId) => cacheFirst(
    cache: _cache,
    key: 'threads:$childId',
    fetch: () async {
      await MockLatency.wait();
      return _threads(childId);
    },
    refetch: () async => _threads(childId),
    refreshOn: _changes.stream,
  );

  List<MessageThread> _threads(String childId) => [
    for (final t in DemoData.threads(childId))
      () {
        final msgs = _chat(t.id);
        final last = msgs.isEmpty ? null : msgs.last;
        final replied = _sent[t.id]?.isNotEmpty ?? false;
        return MessageThread(
          id: t.id,
          childId: t.childId,
          teacher: t.teacher,
          role: t.role,
          lastMessage: last?.text ?? t.lastMessage,
          lastAt: last?.at ?? t.lastAt,
          unread: replied ? 0 : t.unread,
        );
      }(),
  ];

  @override
  Stream<List<ChatMessage>> watchMessages(String threadId) => cacheFirst(
    cache: _cache,
    key: 'chat:$threadId',
    fetch: () async {
      await MockLatency.wait();
      return _chat(threadId);
    },
    refetch: () async => _chat(threadId),
    refreshOn: _changes.stream,
  );

  @override
  Future<void> send(String threadId, String text) async {
    await MockLatency.wait();
    (_sent[threadId] ??= []).add(
      ChatMessage(
        id: 'm_${DateTime.now().microsecondsSinceEpoch}',
        threadId: threadId,
        fromParent: true,
        text: text.trim(),
        at: DateTime.now(),
      ),
    );
    _changes.add(null);
  }
}
