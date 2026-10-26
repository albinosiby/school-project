import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../models/message_models.dart';
import 'message_repository_interface.dart';
import 'messages_demo_data.dart';

/// In-memory messages backend. Seeds each child's demo threads on first use; every write notifies
/// [_changes] so the cache-first streams re-emit.
class MockMessageRepository implements IMessageRepository {
  MockMessageRepository(this._cache);
  final CacheService _cache;
  final _changes = StreamController<void>.broadcast();

  final Map<String, List<MessageThread>> _threads = {};
  final Map<String, List<ChatMessage>> _chats = {};
  final Map<String, List<MessageDraft>> _drafts = {};
  int _seq = 0;

  String _id(String prefix) =>
      '${prefix}_${DateTime.now().microsecondsSinceEpoch}_${_seq++}';

  /// Notifies the open streams on the next event-loop turn, so a stream that has just emitted
  /// (and is about to listen for changes) does not miss a write made in reaction to that value.
  Future<void> _notify() async {
    await Future<void>.delayed(Duration.zero);
    _changes.add(null);
  }

  void _seedAll() {
    for (final c in DemoData.family.children) {
      _seed(c.id);
    }
  }

  void _seed(String childId) {
    if (_threads.containsKey(childId)) return;
    final s = MessagesDemoData.seed(childId);
    _threads[childId] = s.threads;
    _chats.addAll(s.chats);
    _drafts[childId] = MessagesDemoData.drafts(childId);
  }

  /// Seeded thread ids carry the child: `th_<childId>_<x>`.
  String? _childOf(String threadId) {
    for (final e in _threads.entries) {
      if (e.value.any((t) => t.id == threadId)) return e.key;
    }
    final m = RegExp(r'^th_(stu_[a-z0-9]+)_').firstMatch(threadId);
    if (m != null) {
      _seed(m.group(1)!);
      return _childOf(threadId);
    }
    return null;
  }

  MessageThread _thread(String threadId) {
    final childId = _childOf(threadId);
    final t = childId == null
        ? null
        : _threads[childId]!.where((t) => t.id == threadId).firstOrNull;
    if (t == null) throw AppException(message: 'Conversation not found.');
    return t;
  }

  void _replace(MessageThread t) {
    final list = _threads[t.childId]!;
    list[list.indexWhere((e) => e.id == t.id)] = t;
  }

  MessagesOverview _overview(String childId) {
    _seed(childId);
    final drafts = [..._drafts[childId]!]
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return MessagesOverview(
      threads: sortThreads(_threads[childId]!),
      drafts: drafts,
    );
  }

  Conversation _conversation(String threadId) => Conversation(
    thread: _thread(threadId),
    messages: [...?_chats[threadId]]..sort((a, b) => a.at.compareTo(b.at)),
  );

  Stream<T> _watch<T extends Object>(String key, T Function() read) =>
      cacheFirst(
        cache: _cache,
        key: key,
        fetch: () async {
          await MockLatency.wait();
          return read();
        },
        refetch: () async => read(),
        refreshOn: _changes.stream,
      );

  @override
  Stream<MessagesOverview> watchOverview(String childId) =>
      _watch('messages:$childId', () => _overview(childId));

  @override
  Stream<int> watchUnreadCount(String childId) => _watch(
    'messages:unread:$childId',
    () => _overview(childId).unreadThreads,
  ).distinct();

  @override
  Stream<Conversation> watchConversation(String threadId) =>
      _watch('chat:$threadId', () => _conversation(threadId));

  @override
  Stream<List<MessageContact>> watchContacts(String childId) => _watch(
    'messages:contacts:$childId',
    () => MessagesDemoData.contacts(childId),
  );

  @override
  Future<void> send(
    String threadId,
    String text, {
    List<MessageAttachment> attachments = const [],
  }) async {
    final body = text.trim();
    if (body.isEmpty && attachments.isEmpty) {
      throw AppException(message: 'Type a message or attach a file.');
    }
    await MockLatency.wait();
    final t = _thread(threadId);
    final now = DateTime.now();
    (_chats[threadId] ??= []).add(
      ChatMessage(
        id: _id('m'),
        threadId: threadId,
        fromParent: true,
        text: body,
        at: now,
        attachments: attachments,
        read: false,
      ),
    );
    _replace(
      t.copyWith(
        lastMessage: body.isNotEmpty
            ? body
            : '📎 ${attachments.length == 1 ? attachments.first.name : '${attachments.length} files'}',
        lastAt: now,
        unread: 0,
      ),
    );
    await _notify();
  }

  @override
  Future<void> markRead(String threadId) async {
    final t = _thread(threadId);
    if (t.unread == 0) return;
    _replace(t.copyWith(unread: 0));
    await _notify();
  }

  @override
  Future<void> markAllRead(String childId) async {
    _seed(childId);
    _threads[childId] = [
      for (final t in _threads[childId]!) t.copyWith(unread: 0),
    ];
    await _notify();
  }

  @override
  Future<void> setPinned(String threadId, bool pinned) async {
    _replace(_thread(threadId).copyWith(pinned: pinned));
    await _notify();
  }

  @override
  Future<MessageThread> startThread(NewMessageRequest r) async {
    final err = r.error;
    if (err != null) throw AppException(message: err);
    await MockLatency.wait();
    _seed(r.childId);
    final ct = MessagesDemoData.contacts(
      r.childId,
    ).where((c) => c.id == r.contactId).firstOrNull;
    if (ct == null) throw AppException(message: 'Recipient not found.');
    final id = _id('th_${r.childId}_new');
    final now = DateTime.now();
    final text = '${r.subject.trim()}\n\n${r.body.trim()}';
    final thread = MessageThread(
      id: id,
      childId: r.childId,
      contactId: ct.id,
      teacher: ct.name,
      role: ct.badge,
      subtitle: ct.role,
      kind: ct.kind,
      subject: r.subject.trim(),
      lastMessage: r.body.trim(),
      lastAt: now,
      online: ct.online,
    );
    _threads[r.childId]!.add(thread);
    _chats[id] = [
      ChatMessage(
        id: _id('m'),
        threadId: id,
        fromParent: true,
        text: text,
        at: now,
        attachments: r.attachments,
        read: false,
      ),
    ];
    if (r.draftId != null) {
      _drafts[r.childId]!.removeWhere((d) => d.id == r.draftId);
    }
    await _notify();
    return thread;
  }

  @override
  Future<MessageDraft?> draft(String draftId) async {
    _seedAll();
    for (final list in _drafts.values) {
      for (final d in list) {
        if (d.id == draftId) return d;
      }
    }
    return null;
  }

  @override
  Future<MessageDraft> saveDraft(MessageDraft d) async {
    _seed(d.childId);
    final list = _drafts[d.childId]!;
    final saved = MessageDraft(
      id: d.id.isEmpty ? _id('dr_${d.childId}') : d.id,
      childId: d.childId,
      contactId: d.contactId,
      category: d.category,
      subject: d.subject,
      body: d.body,
      attachments: d.attachments,
      updatedAt: DateTime.now(),
    );
    final i = list.indexWhere((e) => e.id == saved.id);
    i < 0 ? list.add(saved) : list[i] = saved;
    await _notify();
    return saved;
  }

  @override
  Future<void> deleteDraft(String draftId) async {
    _seedAll();
    for (final list in _drafts.values) {
      list.removeWhere((d) => d.id == draftId);
    }
    await _notify();
  }
}
