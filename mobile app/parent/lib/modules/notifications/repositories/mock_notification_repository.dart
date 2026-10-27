import 'dart:async';
import '../../../di/demo_data.dart';
import '../../../utils/services/cache_service.dart';
import '../../../utils/services/mock_latency.dart';
import '../../notices/models/notice_models.dart';
import '../../notices/repositories/notice_repository_interface.dart';
import '../models/notification_models.dart';
import 'notification_demo_data.dart';
import 'notification_repository_interface.dart';

/// In-memory notification centre: demo notifications + school notices from [INoticeRepository].
/// Read / deleted state lives in memory; notice acknowledgements write through the notice repository.
class MockNotificationRepository implements INotificationRepository {
  MockNotificationRepository(this._cache, this._notices, {DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  final CacheService _cache;
  final INoticeRepository _notices;
  final DateTime Function() _clock;

  final Set<String> _read = {}, _deleted = {}, _acked = {};
  final _changes = StreamController<void>.broadcast();
  List<AppNotification>? _own;

  // School notices are school-wide (the same for every child in the demo), so the first child's feed is used.
  StreamSubscription<List<Notice>>? _noticeSub;
  final Completer<void> _noticesReady = Completer();
  List<Notice> _latestNotices = const [];

  void _listenNotices() {
    _noticeSub ??= _notices
        .watchNotices(DemoData.family.children.first.id)
        .listen(
          (list) {
            _latestNotices = list;
            if (!_noticesReady.isCompleted) {
              _noticesReady.complete();
            } else {
              _changes.add(null);
            }
          },
          onError: (_) {
            if (!_noticesReady.isCompleted) _noticesReady.complete();
          },
        );
  }

  List<AppNotification> _build() {
    final now = _clock();
    final all = [
      ...(_own ??= NotificationDemoData.own(now)),
      for (final n in _latestNotices) NotificationDemoData.fromNotice(n, now),
    ];
    return [
      for (final n in all)
        if (!_deleted.contains(n.id))
          n.copyWith(
            read: n.read || _read.contains(n.id),
            acknowledged: n.acknowledged || _acked.contains(n.id),
          ),
    ]..sort((a, b) => b.time.compareTo(a.time));
  }

  @override
  Stream<List<AppNotification>> watchNotifications() => cacheFirst(
    cache: _cache,
    key: 'notifications',
    fetch: () async {
      _listenNotices();
      await MockLatency.wait();
      await _noticesReady.future;
      return _build();
    },
    refetch: () async => _build(),
    refreshOn: _changes.stream,
  );

  @override
  Stream<int> watchUnreadCount() =>
      watchNotifications().map((l) => l.where((n) => !n.read).length).distinct();

  Future<void> _write(void Function() change) async {
    await MockLatency.wait();
    change();
    _changes.add(null);
  }

  @override
  Future<void> markRead(String id) => _write(() => _read.add(id));

  @override
  Future<void> markAllRead() => _write(() {
    _read.addAll(_build().map((n) => n.id));
  });

  @override
  Future<void> delete(String id) => _write(() => _deleted.add(id));

  @override
  Future<void> acknowledge(String id) async {
    final n = _build().where((e) => e.id == id).firstOrNull;
    if (n?.noticeId != null) await _notices.acknowledge(n!.noticeId!);
    await _write(() {
      _acked.add(id);
      _read.add(id);
    });
  }
}
