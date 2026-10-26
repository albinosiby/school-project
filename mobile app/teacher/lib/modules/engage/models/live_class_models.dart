import 'package:equatable/equatable.dart';
import 'attachment_models.dart';

enum LiveStatus { draft, upcoming, live, past }

/// A live (virtual) class session — collection `lv_sessions`.
class LiveSession extends Equatable {
  const LiveSession({
    this.id = '', required this.title, required this.classId, this.audience = '', this.subject = '', this.category = '', required this.date, required this.time,
    this.mins = 45, this.room = '', this.medium = 'In-App Live', this.link = '', this.record = true, this.mute = true, this.studentShare = false, this.notify = true,
    this.material, this.joined = 0, this.total = 0, this.tag = '', this.status = LiveStatus.upcoming, this.cohost = '',
    this.meetSpace = '', this.calendarEventId = '', this.calendarLink = '', this.calendarSync = false,
  });
  final String id, title, classId, audience, subject, category, date, time, room, medium, link, tag, cohost;
  /// Google Meet room created in the app (Meet REST API `spaces/...`); empty when the teacher pasted a link.
  final String meetSpace;
  /// The class on the teacher's Google Calendar (Calendar API event id and its web link).
  final String calendarEventId, calendarLink;
  /// Keep the teacher's Google Calendar event in step with this session.
  final bool calendarSync;
  final int mins, joined, total;
  final bool record, mute, studentShare, notify;
  final FileRef? material;
  final LiveStatus status;

  /// `yyyy-MM-dd HH:mm` for chronological sorting.
  String get sortKey => '$date $time';
  bool get isPast => status == LiveStatus.past;
  bool get isDraft => status == LiveStatus.draft;

  factory LiveSession.fromJson(Map<String, dynamic> j) => LiveSession(
        id: '${j['id'] ?? ''}', title: '${j['title'] ?? ''}', classId: '${j['classId'] ?? ''}', audience: '${j['audience'] ?? ''}', subject: '${j['subject'] ?? ''}',
        category: '${j['category'] ?? ''}', date: '${j['date'] ?? ''}', time: '${j['time'] ?? ''}', mins: (j['mins'] as num?)?.toInt() ?? 45, room: '${j['room'] ?? ''}',
        medium: '${j['medium'] ?? ''}', link: '${j['link'] ?? ''}', record: j['record'] == true, mute: j['mute'] == true, studentShare: j['studentShare'] == true,
        notify: j['notify'] == true, material: FileRef.maybe(j['material']), joined: (j['joined'] as num?)?.toInt() ?? 0, total: (j['total'] as num?)?.toInt() ?? 0,
        tag: '${j['tag'] ?? ''}', status: LiveStatus.values.asNameMap()[j['status']] ?? LiveStatus.upcoming, cohost: '${j['cohost'] ?? ''}',
        meetSpace: '${j['meetSpace'] ?? ''}', calendarEventId: '${j['calendarEventId'] ?? ''}', calendarLink: '${j['calendarLink'] ?? ''}', calendarSync: j['calendarSync'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'title': title, 'classId': classId, 'audience': audience, 'subject': subject, 'category': category, 'date': date, 'time': time, 'mins': mins,
        'room': room, 'medium': medium, 'link': link, 'record': record, 'mute': mute, 'studentShare': studentShare, 'notify': notify, 'material': material?.toJson(),
        'joined': joined, 'total': total, 'tag': tag, 'status': status.name, 'cohost': cohost,
        'meetSpace': meetSpace, 'calendarEventId': calendarEventId, 'calendarLink': calendarLink, 'calendarSync': calendarSync,
      };

  LiveSession copyWith({LiveStatus? status, int? joined, String? title, String? room}) =>
      LiveSession.fromJson({...toJson(), 'status': ?status?.name, 'joined': ?joined, 'title': ?title, 'room': ?room});

  @override
  List<Object?> get props => [id, title, classId, audience, subject, category, date, time, mins, room, medium, link, record, mute, studentShare, notify, material, joined, total, tag, status, cohost, meetSpace, calendarEventId, calendarLink, calendarSync];
}

/// A Google Meet room created from the schedule form.
class GoogleMeeting extends Equatable {
  const GoogleMeeting({required this.space, required this.uri, required this.code});
  final String space, uri, code;
  @override
  List<Object?> get props => [space, uri, code];
}
