import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Web OAuth client id (Firebase console > Authentication > Google). Required for Google sign-in on the web build:
/// `--dart-define=GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com`. Android and iOS read theirs from the Firebase config files.
const _webClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

/// `GoogleSignIn.instance.initialize` may run only once per app; every Google feature awaits this.
Future<void>? _googleInit;
Future<void> ensureGoogleSignIn() => _googleInit ??= GoogleSignIn.instance.initialize(clientId: kIsWeb && _webClientId.isNotEmpty ? _webClientId : null);

/// A Google API call failed; [message] can be shown to the teacher as is.
class GoogleWorkspaceException implements Exception {
  const GoogleWorkspaceException(this.message, {this.cancelled = false});
  final String message;
  final bool cancelled;
  @override
  String toString() => message;
}

/// A Meet space created with the Meet REST API (`spaces.create`).
typedef MeetSpace = ({String name, String uri, String code});

/// A Google Calendar event (`events.insert` / `events.patch`).
typedef CalendarEvent = ({String id, String htmlLink});

/// The teacher's own Google account, used to create Meet rooms and calendar events.
/// Separate from the app login: a teacher signed in with a school email can connect any Google account.
class GoogleWorkspaceService {
  GoogleWorkspaceService({Dio? dio}) : _dio = dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 20), receiveTimeout: const Duration(seconds: 20)));
  final Dio _dio;

  /// Create Meet spaces + create/edit/delete the teacher's calendar events. Nothing else is requested.
  static const scopes = ['https://www.googleapis.com/auth/meetings.space.created', 'https://www.googleapis.com/auth/calendar.events'];

  /// An access token for [scopes]; asks the teacher to pick an account and consent the first time.
  Future<String> _token({bool forceNew = false}) async {
    await ensureGoogleSignIn();
    final client = GoogleSignIn.instance.authorizationClient;
    try {
      final cached = forceNew ? null : await client.authorizationForScopes(scopes);
      return (cached ?? await client.authorizeScopes(scopes)).accessToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) throw const GoogleWorkspaceException('Google sign-in was cancelled', cancelled: true);
      throw GoogleWorkspaceException('Could not connect your Google account (${e.code.name}). ${e.description ?? ''}'.trim());
    }
  }

  /// Runs [call] with a bearer token; on 401 the cached token is dropped and the call retried once.
  Future<Map<String, dynamic>> _send(Future<Response<dynamic>> Function(Options o) call) async {
    for (var attempt = 0; attempt < 2; attempt++) {
      final token = await _token(forceNew: attempt > 0);
      try {
        final r = await call(Options(headers: {'Authorization': 'Bearer $token'}));
        return r.data is Map ? Map<String, dynamic>.from(r.data as Map) : const {};
      } on DioException catch (e) {
        final code = e.response?.statusCode;
        if (code == 401 && attempt == 0) {
          await GoogleSignIn.instance.authorizationClient.clearAuthorizationToken(accessToken: token);
          continue;
        }
        throw GoogleWorkspaceException(_explain(e));
      }
    }
    throw const GoogleWorkspaceException('Google did not accept the sign-in. Please try again.');
  }

  static String _explain(DioException e) {
    final body = e.response?.data;
    final err = body is Map ? body['error'] : null;
    final msg = err is Map ? '${err['message'] ?? ''}' : '';
    final status = err is Map ? '${err['status'] ?? ''}' : '';
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) return 'No internet connection. Check your network and try again.';
    if (msg.contains('has not been used') || msg.contains('is disabled')) return 'Google Meet / Calendar is not enabled for this school yet. Ask the school admin.';
    if (status == 'PERMISSION_DENIED') return 'Your Google account cannot create Meet rooms or calendar events ($msg)';
    return msg.isEmpty ? 'Google request failed (${e.response?.statusCode ?? e.type.name})' : msg;
  }

  /// Meet REST API: a new meeting room anyone with the link can join without knocking (students and parents
  /// may not use school Google accounts). https://developers.google.com/meet/api/reference/rest/v2/spaces/create
  Future<MeetSpace> createSpace() async {
    final j = await _send((o) => _dio.post('https://meet.googleapis.com/v2/spaces', data: {
          'config': {'accessType': 'OPEN', 'entryPointAccess': 'ALL'},
        }, options: o));
    final uri = '${j['meetingUri'] ?? ''}';
    if (uri.isEmpty) throw const GoogleWorkspaceException('Google Meet did not return a meeting link');
    return (name: '${j['name'] ?? ''}', uri: uri, code: '${j['meetingCode'] ?? ''}');
  }

  /// Calendar API: puts the class on the teacher's primary calendar with the Meet link (create when [eventId] is null,
  /// otherwise update). Times are India time. https://developers.google.com/calendar/api/v3/reference/events
  Future<CalendarEvent> upsertEvent({String? eventId, required String title, required String description, required String meetUri,
      required String date, required String time, required int mins}) async {
    final start = DateTime.parse('${date}T$time:00');
    final end = start.add(Duration(minutes: mins));
    String fmt(DateTime d) => '${d.toIso8601String().substring(0, 19)}+05:30';
    final body = {
      'summary': title, 'description': '$description\n\nJoin: $meetUri', 'location': meetUri,
      'start': {'dateTime': fmt(start), 'timeZone': 'Asia/Kolkata'}, 'end': {'dateTime': fmt(end), 'timeZone': 'Asia/Kolkata'},
      'reminders': {'useDefault': false, 'overrides': [{'method': 'popup', 'minutes': 10}]},
      'source': {'title': 'EduAdmin Teacher', 'url': meetUri},
    };
    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    final j = await _send((o) => eventId == null ? _dio.post(base, data: body, options: o) : _dio.patch('$base/$eventId', data: body, options: o));
    return (id: '${j['id'] ?? ''}', htmlLink: '${j['htmlLink'] ?? ''}');
  }

  /// Removes the class from the teacher's calendar (already deleted counts as done).
  Future<void> deleteEvent(String eventId) async {
    try {
      await _send((o) => _dio.delete('https://www.googleapis.com/calendar/v3/calendars/primary/events/$eventId', options: o));
    } on GoogleWorkspaceException catch (e) {
      if (!e.message.contains('Not Found') && !e.message.contains('deleted')) rethrow;
    }
  }
}
