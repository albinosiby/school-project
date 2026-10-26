import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../../../utils/services/local_storage_service.dart';
import '../../notices/repositories/notice_repository_interface.dart';
import '../models/notification_models.dart';
import 'notification_repository_interface.dart';

/// The guardian's notification centre from `par_notifications` (rows the Cloud Functions write with every push,
/// data contract §13.4). The parent may only set `read`; "delete" hides a row on this device. Notice rows
/// (`ntc_{noticeId}_{uid}`) carry the notice id, and acknowledging them writes through the notice repository.
class FirebaseNotificationRepository implements INotificationRepository {
  FirebaseNotificationRepository(this._session, this._notices, this._storage);
  final ParentSession _session;
  final INoticeRepository _notices;
  final LocalStorageService _storage;
  final _hiddenChanged = StreamController<void>.broadcast();
  final Set<String> _acked = {};

  String get _hiddenKey => 'notif_hidden:${_session.uid}';
  Set<String> get _hidden => {
    ...?_storage.getString(_hiddenKey)?.split('\n').where((s) => s.isNotEmpty),
  };

  @override
  Stream<List<AppNotification>> watchNotifications() {
    late final StreamController<List<AppNotification>> out;
    final subs = <StreamSubscription<Object?>>[];
    QuerySnapshot<Json>? last;
    void emit() {
      final q = last;
      if (q == null || out.isClosed) return;
      final hidden = _hidden;
      out.add(
        [
          for (final d in q.docs)
            if (!hidden.contains(d.id))
              fromDoc(d.id, d.data(), _session.uid, _acked),
        ]..sort((a, b) => b.time.compareTo(a.time)),
      );
    }

    out = StreamController<List<AppNotification>>(
      onListen: () => subs
        ..add(
          _session
              .whenReady(
                () => _session
                    .col('par_notifications')
                    .where('uid', isEqualTo: _session.uid)
                    .snapshots(),
              )
              .listen((q) {
                last = q;
                emit();
              }, onError: out.addError),
        )
        ..add(_hiddenChanged.stream.listen((_) => emit())),
      onCancel: () async {
        for (final s in subs) {
          await s.cancel();
        }
      },
    );
    return out.stream;
  }

  @override
  Stream<int> watchUnreadCount() =>
      watchNotifications().map((l) => l.where((n) => !n.read).length);

  @override
  Future<void> markRead(String id) =>
      _session.col('par_notifications').doc(id).update({'read': true});

  @override
  Future<void> markAllRead() async {
    final q = await _session
        .col('par_notifications')
        .where('uid', isEqualTo: _session.uid)
        .where('read', isEqualTo: false)
        .get();
    for (final d in q.docs) {
      await d.reference.update({'read': true});
    }
  }

  @override
  Future<void> delete(String id) async {
    await _storage.setString(_hiddenKey, {..._hidden, id}.join('\n'));
    _hiddenChanged.add(null);
  }

  @override
  Future<void> acknowledge(String id) async {
    final noticeId = noticeIdOf(id, _session.uid);
    if (noticeId != null) await _notices.acknowledge(noticeId);
    _acked.add(id);
    await markRead(id);
  }

  /// `ntc_{noticeId}_{uid}` -> noticeId.
  static String? noticeIdOf(String id, String uid) =>
      id.startsWith('ntc_') && id.endsWith('_$uid')
      ? id.substring(4, id.length - uid.length - 1)
      : null;

  static NotificationCategory categoryOf(Json d) {
    final title = '${d['title'] ?? ''}'.toLowerCase();
    return switch ('${d['type'] ?? ''}') {
      'fees' => NotificationCategory.fees,
      'notice' when title.startsWith('urgent') =>
        NotificationCategory.emergency,
      'notice' || 'message' => NotificationCategory.notice,
      'attendance' when title.contains('absence') =>
        NotificationCategory.emergency,
      _ => NotificationCategory.academic,
    };
  }

  static AppNotification fromDoc(
    String id,
    Json d,
    String uid,
    Set<String> acked,
  ) {
    final noticeId = noticeIdOf(id, uid);
    final urgent = '${d['title'] ?? ''}'.toLowerCase().startsWith('urgent');
    final route = '${d['route'] ?? ''}';
    return AppNotification(
      id: id,
      category: categoryOf(d),
      title: '${d['title'] ?? ''}',
      body: '${d['body'] ?? ''}',
      summary: '${d['body'] ?? ''}',
      time: parseTime(d['at']) ?? parseTime(d['createdAt']) ?? DateTime.now(),
      actionLabel: route.isEmpty ? null : 'Open',
      actionRoute: route.isEmpty ? null : route,
      noticeId: noticeId,
      requiresAck: noticeId != null && urgent,
      acknowledged: acked.contains(id),
      read: d['read'] == true,
    );
  }
}
