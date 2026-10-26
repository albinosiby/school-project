import '../models/live_class_models.dart';

/// Google Meet rooms and Google Calendar events for live classes, on the teacher's own Google account.
abstract class IMeetSchedulingRepository {
  /// A new Meet room (Meet REST API). Throws [GoogleWorkspaceException] (`cancelled` when the teacher backs out).
  Future<GoogleMeeting> createMeeting();

  /// Creates or updates the class on the teacher's Google Calendar; returns [session] with the event id and link.
  Future<LiveSession> syncCalendar(LiveSession session);

  /// Removes the class from the teacher's Google Calendar (no-op without an event).
  Future<void> removeFromCalendar(LiveSession session);
}
