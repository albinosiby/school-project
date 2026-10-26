import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/seed_data.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_events.dart';
import 'package:teacher_app/modules/engage/models/live_class_models.dart';
import 'package:teacher_app/modules/engage/repositories/live_class_repository.dart';
import 'package:teacher_app/modules/engage/repositories/meet_scheduling_repository_interface.dart';
import 'package:teacher_app/utils/services/google/google_workspace_service.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';

/// Stands in for the Google Meet REST API + Calendar API.
class FakeMeet implements IMeetSchedulingRepository {
  String mode = 'ok'; // ok | cancel | fail
  final synced = <LiveSession>[];
  final removed = <String>[];
  @override
  Future<GoogleMeeting> createMeeting() async {
    if (mode == 'cancel') throw const GoogleWorkspaceException('cancelled', cancelled: true);
    if (mode == 'fail') throw const GoogleWorkspaceException('Google Meet / Calendar is not enabled for this school yet. Ask the school admin.');
    return const GoogleMeeting(space: 'spaces/abc123', uri: 'https://meet.google.com/abc-mnop-xyz', code: 'abc-mnop-xyz');
  }

  @override
  Future<LiveSession> syncCalendar(LiveSession s) async {
    if (mode == 'fail') throw const GoogleWorkspaceException('Calendar quota exceeded');
    synced.add(s);
    return LiveSession.fromJson({...s.toJson(), 'calendarEventId': s.calendarEventId.isEmpty ? 'evt_1' : s.calendarEventId, 'calendarLink': 'https://calendar.google.com/event?eid=1'});
  }

  @override
  Future<void> removeFromCalendar(LiveSession s) async => removed.add(s.calendarEventId);
}

LiveSession _session({String eventId = '', bool sync = true}) => LiveSession(
      title: 'Quadratics doubt clearing', classId: 'cls_10B', audience: 'Class 10–B (42 Students)', subject: 'Mathematics', category: 'Doubt Clearing',
      date: '2030-01-10', time: '16:30', mins: 45, medium: 'Google Meet', link: 'https://meet.google.com/abc-mnop-xyz', meetSpace: 'spaces/abc123',
      calendarEventId: eventId, calendarSync: sync, total: 42,
    );

void main() {
  late LocalDatabaseService db;
  late FakeMeet meet;
  late LiveClassesBloc bloc;
  setUp(() {
    db = LocalDatabaseService.memory(buildSeed());
    meet = FakeMeet();
    bloc = LiveClassesBloc(LocalLiveClassRepository(db), meet);
  });
  tearDown(() => bloc.close());

  test('Create Google Meet fills the meeting', () async {
    bloc.add(const LiveMeetCreateRequested());
    final s = await bloc.stream.firstWhere((s) => s.meeting != null);
    expect(s.meeting!.uri, 'https://meet.google.com/abc-mnop-xyz');
    expect(s.meetBusy, isFalse);
    expect(s.notice!.message, contains('meet.google.com/abc-mnop-xyz'));
  });

  test('closing the Google picker is silent; API errors are shown', () async {
    meet.mode = 'cancel';
    bloc.add(const LiveMeetCreateRequested());
    final a = await bloc.stream.firstWhere((s) => !s.meetBusy);
    expect(a.meeting, isNull);
    expect(a.notice, isNull);
    meet.mode = 'fail';
    bloc.add(const LiveMeetCreateRequested());
    final b = await bloc.stream.firstWhere((s) => !s.meetBusy && s.notice != null);
    expect(b.notice!.message, contains('not enabled'));
  });

  test('scheduling puts the class on Google Calendar and stores the event', () async {
    bloc.add(LiveSessionSaved(_session()));
    final s = await bloc.stream.firstWhere((s) => s.notice?.message.contains('Google Calendar') ?? false);
    expect(meet.synced, hasLength(1));
    final saved = db.list('lv_sessions').firstWhere((r) => r['title'] == 'Quadratics doubt clearing');
    expect(saved['calendarEventId'], 'evt_1');
    expect(saved['meetSpace'], 'spaces/abc123');
    expect(s.notice!.message, contains('added to your Google Calendar'));
  });

  test('drafts and switched-off sync do not touch the calendar; a calendar error still saves the class', () async {
    bloc.add(LiveSessionSaved(_session(), draft: true));
    await bloc.stream.firstWhere((s) => s.notice?.message == 'Draft saved');
    bloc.add(LiveSessionSaved(_session(sync: false)));
    await bloc.stream.firstWhere((s) => s.notice?.message.startsWith('Class scheduled') ?? false);
    expect(meet.synced, isEmpty);
    meet.mode = 'fail';
    bloc.add(LiveSessionSaved(_session()));
    final s = await bloc.stream.firstWhere((s) => s.notice?.message.contains('quota') ?? false);
    expect(s.notice!.message, startsWith('Class scheduled'));
  });

  test('cancelling a class removes its calendar event', () async {
    bloc.add(LiveSessionSaved(_session()));
    await bloc.stream.firstWhere((s) => s.notice?.message.contains('Google Calendar') ?? false);
    final id = '${db.list('lv_sessions').firstWhere((r) => r['title'] == 'Quadratics doubt clearing')['id']}';
    bloc.add(LiveSessionDeleted(id, message: 'Class cancelled'));
    await bloc.stream.firstWhere((s) => s.notice?.message == 'Class cancelled');
    expect(meet.removed, ['evt_1']);
  });
}
