import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// A push message reduced to what the app shows: title, body and the screen to open.
typedef PushMessage = ({String title, String body, String? route});

/// Firebase Cloud Messaging for the signed-in teacher.
/// On login: asks for notification permission, saves this device's FCM token at
/// `users/{uid}/fcm_tokens/{token}` (Cloud Functions send to those) and keeps it fresh.
/// On logout: removes the token so the device stops receiving the teacher's notifications.
class PushNotificationService {
  PushNotificationService({FirebaseMessaging? messaging, FirebaseFirestore? firestore})
      : _m = messaging,
        _fs = firestore;
  FirebaseMessaging? _m;
  FirebaseFirestore? _fs;
  FirebaseMessaging get _messaging => _m ??= FirebaseMessaging.instance;
  FirebaseFirestore get _db => _fs ??= FirebaseFirestore.instance;

  /// High-importance Android channel: pushes pop up on screen with sound (the FCM fallback channel only lands quietly
  /// in the tray). The manifest makes it the default for pushes received in the background.
  static const channel = AndroidNotificationChannel(
    'school_updates',
    'School updates',
    description: 'Circulars, messages, meetings and other school updates',
    importance: Importance.high,
  );
  final _local = FlutterLocalNotificationsPlugin();
  bool _localReady = false;
  int _nextId = 0;

  final _foreground = StreamController<PushMessage>.broadcast();
  final _opened = StreamController<String>.broadcast();
  final _subs = <StreamSubscription<Object?>>[];
  String? _uid, _token;

  /// Messages that arrive while the app is open (the system does not show those on Android).
  Stream<PushMessage> get foregroundMessages => _foreground.stream;

  /// Routes of notifications the teacher tapped.
  Stream<String> get openedRoutes => _opened.stream;

  static PushMessage toMessage(RemoteMessage m) => (
        title: m.notification?.title ?? '${m.data['title'] ?? 'School update'}',
        body: m.notification?.body ?? '${m.data['body'] ?? ''}',
        route: (m.data['route'] as String?)?.isNotEmpty == true ? m.data['route'] as String : null,
      );

  /// Whether this device lets the app show notifications (null on the web, where push is not set up).
  Future<bool?> permissionGranted() async {
    if (kIsWeb) return null;
    final s = await _messaging.getNotificationSettings();
    return s.authorizationStatus == AuthorizationStatus.authorized || s.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Asks again (Android shows the prompt only while the teacher has not blocked it for good); registers the token when granted.
  Future<bool?> enable() async {
    if (kIsWeb) return null;
    final s = await _messaging.requestPermission(alert: true, badge: true, sound: true);
    final ok = s.authorizationStatus == AuthorizationStatus.authorized || s.authorizationStatus == AuthorizationStatus.provisional;
    final uid = _uid;
    if (ok && uid != null && _token == null) {
      _uid = null;
      await start(uid);
    }
    return ok;
  }

  /// Call after sign-in. Never throws: notifications are optional for using the app.
  Future<void> start(String uid) async {
    if (_uid == uid) return;
    await stop();
    _uid = uid;
    // Web push needs a VAPID key and a service worker; the teacher app targets phones.
    if (kIsWeb) return;
    try {
      final settings = await _messaging.requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      await _messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
      await _initLocal();
      final token = await _messaging.getToken();
      if (token != null) await _save(token);
      _subs
        ..add(_messaging.onTokenRefresh.listen(_save))
        ..add(FirebaseMessaging.onMessage.listen(_onForeground))
        ..add(FirebaseMessaging.onMessageOpenedApp.listen(_open));
      final initial = await _messaging.getInitialMessage();
      if (initial != null) _open(initial);
    } catch (e) {
      debugPrint('push setup skipped: $e');
    }
  }

  Future<void> _initLocal() async {
    if (_localReady || defaultTargetPlatform != TargetPlatform.android) return;
    await _local.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (r) {
        final route = r.payload;
        if (route != null && route.isNotEmpty) _opened.add(route);
      },
    );
    await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);
    _localReady = true;
  }

  /// Android shows nothing for a push while the app is open: post it as a real notification (iOS shows it already
  /// through the presentation options). Falls back to the in-app banner when that is not possible.
  Future<void> _onForeground(RemoteMessage m) async {
    final msg = toMessage(m);
    if (_localReady) {
      try {
        await _local.show(
          id: _nextId++,
          title: msg.title,
          body: msg.body,
          payload: msg.route,
          notificationDetails: NotificationDetails(
            android: AndroidNotificationDetails(
              channel.id,
              channel.name,
              channelDescription: channel.description,
              importance: Importance.high,
              priority: Priority.high,
              styleInformation: BigTextStyleInformation(msg.body),
            ),
          ),
        );
        return;
      } catch (e) {
        debugPrint('local notification failed: $e');
      }
    }
    if (defaultTargetPlatform == TargetPlatform.android) _foreground.add(msg);
  }

  void _open(RemoteMessage m) {
    final r = toMessage(m).route;
    if (r != null) _opened.add(r);
  }

  Future<void> _save(String token) async {
    final uid = _uid;
    if (uid == null) return;
    if (_token != null && _token != token) await _tokenDoc(uid, _token!).delete().catchError((_) {});
    _token = token;
    await _tokenDoc(uid, token).set({
      'token': token,
      'app': 'teacher',
      'platform': defaultTargetPlatform.name,
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  DocumentReference<Map<String, dynamic>> _tokenDoc(String uid, String token) => _db.doc('users/$uid/fcm_tokens/$token');

  /// Call before sign-out (the token doc can only be deleted while signed in).
  Future<void> stop() async {
    for (final s in _subs) {
      await s.cancel();
    }
    _subs.clear();
    final uid = _uid, token = _token;
    _uid = null;
    _token = null;
    if (uid == null || token == null) return;
    try {
      await _tokenDoc(uid, token).delete();
      await _messaging.deleteToken();
    } catch (e) {
      debugPrint('push token cleanup failed: $e');
    }
  }
}
