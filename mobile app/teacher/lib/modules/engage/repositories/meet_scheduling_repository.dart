import '../../../utils/services/google/google_workspace_service.dart';
import '../models/live_class_models.dart';
import 'meet_scheduling_repository_interface.dart';

class GoogleMeetSchedulingRepository implements IMeetSchedulingRepository {
  GoogleMeetSchedulingRepository(this._google);
  final GoogleWorkspaceService _google;

  @override
  Future<GoogleMeeting> createMeeting() async {
    final s = await _google.createSpace();
    return GoogleMeeting(space: s.name, uri: s.uri, code: s.code);
  }

  @override
  Future<LiveSession> syncCalendar(LiveSession s) async {
    final ev = await _google.upsertEvent(
      eventId: s.calendarEventId.isEmpty ? null : s.calendarEventId,
      title: '${s.title} (${s.audience.split(' (').first})',
      description: '${s.category} · ${s.subject} live class for ${s.audience}.',
      meetUri: s.link, date: s.date, time: s.time, mins: s.mins,
    );
    return LiveSession.fromJson({...s.toJson(), 'calendarEventId': ev.id, 'calendarLink': ev.htmlLink});
  }

  @override
  Future<void> removeFromCalendar(LiveSession s) async {
    if (s.calendarEventId.isNotEmpty) await _google.deleteEvent(s.calendarEventId);
  }
}
