import 'package:equatable/equatable.dart';
import '../../../constants/app_constants.dart';
import '../../teachers/models/teacher_models.dart';

enum MeetingMode {
  inPerson('In-Person'),
  virtual('Virtual');

  const MeetingMode(this.label);
  final String label;
}

enum MeetingStatus {
  scheduled('Scheduled'),
  attended('Attended'),
  missed('Missed'),
  cancelled('Cancelled');

  const MeetingStatus(this.label);
  final String label;
}

/// A parent-teacher meeting of one child (`meetings` + `bookings` in the data contract).
class Meeting extends Equatable {
  const Meeting({
    required this.id,
    required this.childId,
    required this.title,
    required this.agenda,
    required this.teacherId,
    required this.teacherName,
    required this.teacherRole,
    required this.start,
    required this.mins,
    required this.mode,
    required this.location,
    this.link,
    this.status = MeetingStatus.scheduled,
    this.minutes,
    this.slotId,
    this.joinedAt,
  });

  final String id, childId, title, agenda, teacherId, teacherName, teacherRole;
  final DateTime start;
  final int mins;
  final MeetingMode mode;

  /// Room for in-person meetings, "Google Meet" for virtual ones.
  final String location;
  final String? link;
  final MeetingStatus status;

  /// Summary of the minutes (past meetings); null when none were published.
  final String? minutes;

  /// Booked slot (meetings booked from the app).
  final String? slotId;
  final DateTime? joinedAt;

  DateTime get end => start.add(Duration(minutes: mins));
  bool isUpcoming(DateTime now) =>
      status == MeetingStatus.scheduled && end.isAfter(now);
  bool isPast(DateTime now) => !isUpcoming(now);

  /// Same rule as live classes: Join opens 10 minutes before the start and closes at the end.
  bool canJoinAt(DateTime now) =>
      mode == MeetingMode.virtual &&
      link != null &&
      status == MeetingStatus.scheduled &&
      !now.isBefore(start.subtract(AppConstants.joinLeadTime)) &&
      now.isBefore(end);

  /// Status shown on past cards: a scheduled meeting whose time has passed counts as attended.
  MeetingStatus statusAt(DateTime now) =>
      status == MeetingStatus.scheduled && !end.isAfter(now)
      ? MeetingStatus.attended
      : status;

  Meeting copyWith({
    DateTime? start,
    MeetingStatus? status,
    String? slotId,
    DateTime? joinedAt,
  }) => Meeting(
    id: id,
    childId: childId,
    title: title,
    agenda: agenda,
    teacherId: teacherId,
    teacherName: teacherName,
    teacherRole: teacherRole,
    start: start ?? this.start,
    mins: mins,
    mode: mode,
    location: location,
    link: link,
    status: status ?? this.status,
    minutes: minutes,
    slotId: slotId ?? this.slotId,
    joinedAt: joinedAt ?? this.joinedAt,
  );

  @override
  List<Object?> get props => [
    id,
    childId,
    title,
    agenda,
    teacherId,
    teacherName,
    teacherRole,
    start,
    mins,
    mode,
    location,
    link,
    status,
    minutes,
    slotId,
    joinedAt,
  ];
}

/// A bookable time slot a teacher has published.
class PtmSlot extends Equatable {
  const PtmSlot({
    required this.id,
    required this.teacherId,
    required this.start,
    this.mins = 20,
    this.booked = false,
  });
  final String id, teacherId;
  final DateTime start;
  final int mins;
  final bool booked;

  @override
  List<Object?> get props => [id, teacherId, start, mins, booked];
}

/// Everything the PTM screen needs for one child.
class PtmData extends Equatable {
  const PtmData({
    required this.meetings,
    required this.teachers,
    required this.slots,
  });
  final List<Meeting> meetings;
  final List<Teacher> teachers;
  final List<PtmSlot> slots;

  List<Meeting> upcoming(DateTime now) =>
      meetings.where((m) => m.isUpcoming(now)).toList()
        ..sort((a, b) => a.start.compareTo(b.start));
  List<Meeting> past(DateTime now) =>
      meetings.where((m) => m.isPast(now)).toList()
        ..sort((a, b) => b.start.compareTo(a.start));

  List<PtmSlot> slotsOf(String teacherId) =>
      slots.where((s) => s.teacherId == teacherId).toList()
        ..sort((a, b) => a.start.compareTo(b.start));

  Teacher? teacher(String id) {
    for (final t in teachers) {
      if (t.id == id) return t;
    }
    return null;
  }

  @override
  List<Object?> get props => [meetings, teachers, slots];
}
