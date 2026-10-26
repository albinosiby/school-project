import 'package:equatable/equatable.dart';
import 'attachment_models.dart';

/// One agenda point of a parent meeting.
class AgendaTopic extends Equatable {
  const AgendaTopic({required this.title, required this.mins, this.objective = '', this.resource});
  final String title, objective;
  final int mins;
  final String? resource;
  factory AgendaTopic.fromJson(Map<String, dynamic> j) =>
      AgendaTopic(title: '${j['title'] ?? ''}', mins: (j['mins'] as num?)?.toInt() ?? 0, objective: '${j['objective'] ?? ''}', resource: j['resource'] as String?);
  Map<String, dynamic> toJson() => {'title': title, 'mins': mins, 'objective': objective, 'resource': resource};
  AgendaTopic copyWith({String? title, int? mins}) => AgendaTopic(title: title ?? this.title, mins: mins ?? this.mins, objective: objective, resource: resource);
  @override
  List<Object?> get props => [title, mins, objective, resource];
}

enum MeetingStatus { draft, upcoming, completed }

/// A parent-teacher meeting — collection `pm_meetings`.
class Meeting extends Equatable {
  const Meeting({
    this.id = '', required this.title, required this.classId, this.audience = '', this.category = '', this.format = '', required this.date, required this.time, this.mins = 60,
    this.venue = '', this.link = '', this.agenda = const [], this.rsvp = 0, this.total = 0, this.target = 90, this.file, this.status = MeetingStatus.upcoming,
    this.invite = true, this.whatsapp = false, this.summary = '', this.startedAt = 0,
  });
  final String id, title, classId, audience, category, format, date, time, venue, link, summary;
  final int mins, rsvp, total, target, startedAt;
  final List<AgendaTopic> agenda;
  final FileRef? file;
  final MeetingStatus status;
  final bool invite, whatsapp;

  bool get completed => status == MeetingStatus.completed;
  String get sortKey => '$date $time';

  factory Meeting.fromJson(Map<String, dynamic> j) => Meeting(
        id: '${j['id'] ?? ''}', title: '${j['title'] ?? ''}', classId: '${j['classId'] ?? ''}', audience: '${j['audience'] ?? ''}', category: '${j['category'] ?? ''}',
        format: '${j['format'] ?? ''}', date: '${j['date'] ?? ''}', time: '${j['time'] ?? ''}', mins: (j['mins'] as num?)?.toInt() ?? 60, venue: '${j['venue'] ?? ''}',
        link: '${j['link'] ?? ''}', agenda: [for (final a in (j['agenda'] as List? ?? const [])) AgendaTopic.fromJson(Map<String, dynamic>.from(a as Map))],
        rsvp: (j['rsvp'] as num?)?.toInt() ?? 0, total: (j['total'] as num?)?.toInt() ?? 0, target: (j['target'] as num?)?.toInt() ?? 90, file: FileRef.maybe(j['file']),
        status: MeetingStatus.values.asNameMap()[j['status']] ?? MeetingStatus.upcoming, invite: j['invite'] == true, whatsapp: j['whatsapp'] == true,
        summary: '${j['summary'] ?? ''}', startedAt: (j['startedAt'] as num?)?.toInt() ?? 0,
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'title': title, 'classId': classId, 'audience': audience, 'category': category, 'format': format, 'date': date, 'time': time, 'mins': mins, 'venue': venue,
        'link': link, 'agenda': [for (final a in agenda) a.toJson()], 'rsvp': rsvp, 'total': total, 'target': target, 'file': file?.toJson(), 'status': status.name,
        'invite': invite, 'whatsapp': whatsapp, 'summary': summary, 'startedAt': startedAt,
      };
  Meeting copyWith({MeetingStatus? status, List<AgendaTopic>? agenda, String? summary, int? startedAt}) => Meeting.fromJson({
        ...toJson(), 'status': ?status?.name, 'agenda': ?agenda?.map((a) => a.toJson()).toList(), 'summary': ?summary, 'startedAt': ?startedAt,
      });

  @override
  List<Object?> get props => [id, title, classId, audience, category, format, date, time, mins, venue, link, agenda, rsvp, total, target, file, status, invite, whatsapp, summary, startedAt];
}

/// Someone in the meeting room — collection `pm_participants`.
class Participant extends Equatable {
  const Participant({this.id = '', required this.meetingId, required this.name, this.sub = '', this.role = 'Parent', this.muted = true, this.speaking = false, this.hand = false});
  final String id, meetingId, name, sub, role;
  final bool muted, speaking, hand;
  bool get coHost => role == 'Co-Host';
  factory Participant.fromJson(Map<String, dynamic> j) => Participant(
        id: '${j['id'] ?? ''}', meetingId: '${j['meetingId'] ?? ''}', name: '${j['name'] ?? ''}', sub: '${j['sub'] ?? ''}', role: '${j['role'] ?? 'Parent'}',
        muted: j['muted'] == true, speaking: j['speaking'] == true, hand: j['hand'] == true,
      );
  Map<String, dynamic> toJson() => {'id': id, 'meetingId': meetingId, 'name': name, 'sub': sub, 'role': role, 'muted': muted, 'speaking': speaking, 'hand': hand};
  Participant copyWith({bool? muted, bool? speaking}) => Participant.fromJson({...toJson(), 'muted': ?muted, 'speaking': ?speaking});
  @override
  List<Object?> get props => [id, meetingId, name, sub, role, muted, speaking, hand];
}

/// A guest waiting to be admitted — collection `pm_waiting`.
class WaitingGuest extends Equatable {
  const WaitingGuest({required this.id, required this.meetingId, required this.name, this.sub = '', this.cls = '', this.since = ''});
  final String id, meetingId, name, sub, cls, since;
  int get waitingMins => DateTime.now().difference(DateTime.tryParse(since) ?? DateTime.now()).inMinutes;
  factory WaitingGuest.fromJson(Map<String, dynamic> j) => WaitingGuest(
      id: '${j['id'] ?? ''}', meetingId: '${j['meetingId'] ?? ''}', name: '${j['name'] ?? ''}', sub: '${j['sub'] ?? ''}', cls: '${j['cls'] ?? ''}', since: '${j['since'] ?? ''}');
  Map<String, dynamic> toJson() => {'id': id, 'meetingId': meetingId, 'name': name, 'sub': sub, 'cls': cls, 'since': since};
  WaitingGuest copyWith({String? since}) => WaitingGuest.fromJson({...toJson(), 'since': ?since});
  @override
  List<Object?> get props => [id, meetingId, name, sub, cls, since];
}

/// A live chat message in a meeting — collection `pm_chat`.
class ChatMessage extends Equatable {
  const ChatMessage({this.id = '', required this.meetingId, required this.name, this.mine = false, this.pinned = false, required this.ts, required this.text});
  final String id, meetingId, name, ts, text;
  final bool mine, pinned;
  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
      id: '${j['id'] ?? ''}', meetingId: '${j['meetingId'] ?? ''}', name: '${j['name'] ?? ''}', mine: j['mine'] == true, pinned: j['pinned'] == true, ts: '${j['ts'] ?? ''}', text: '${j['text'] ?? ''}');
  Map<String, dynamic> toJson() => {'id': id, 'meetingId': meetingId, 'name': name, 'mine': mine, 'pinned': pinned, 'ts': ts, 'text': text};
  ChatMessage copyWith({bool? pinned}) => ChatMessage.fromJson({...toJson(), 'pinned': ?pinned});
  @override
  List<Object?> get props => [id, meetingId, name, mine, pinned, ts, text];
}
