import 'package:equatable/equatable.dart';
import 'attachment_models.dart';

/// Someone a message can be sent to: a saved contact (`ms_contacts`), a student or a guardian (`g_<studentId>`).
/// [kind] is parent / staff / student / broadcast. A non-empty [blocked] says why the recipient cannot be messaged
/// (a guardian without a parent app login); such recipients are listed but cannot be selected.
class Recipient extends Equatable {
  const Recipient({required this.id, required this.name, this.role = '', this.kind = 'parent', this.sub = '', this.extra = '', this.online = false, this.blocked = '', this.phone = ''});
  /// [phone] is the guardian's number from the student record (empty for staff and groups).
  final String id, name, role, kind, sub, extra, blocked, phone;
  final bool online;
  bool get broadcast => kind == 'broadcast';
  bool get available => blocked.isEmpty;
  factory Recipient.fromJson(Map<String, dynamic> j) => Recipient(
      id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', role: '${j['role'] ?? ''}', kind: '${j['kind'] ?? 'parent'}', sub: '${j['sub'] ?? ''}', extra: '${j['extra'] ?? ''}', online: j['online'] == true,
      blocked: '${j['blocked'] ?? ''}', phone: '${j['phone'] ?? ''}');
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role, 'kind': kind, 'sub': sub, 'extra': extra, 'online': online, if (blocked.isNotEmpty) 'blocked': blocked, if (phone.isNotEmpty) 'phone': phone};
  Recipient copyWith({bool? online}) => Recipient.fromJson({...toJson(), 'online': ?online});
  @override
  List<Object?> get props => [id, name, role, kind, sub, extra, online, blocked, phone];
}

/// A meeting scheduled from a chat (collection `ms_meetings`, shared as `msg_meetings`). [status] is
/// scheduled / cancelled. [date] is yyyy-MM-dd and [time] HH:mm in the school's local time.
class ChatMeeting extends Equatable {
  const ChatMeeting({this.id = '', this.threadId = '', required this.date, required this.time, required this.link, this.note = '', this.status = 'scheduled', this.createdAt = '', this.updatedAt = ''});
  final String id, threadId, date, time, link, note, status, createdAt, updatedAt;
  DateTime? get startsAt => DateTime.tryParse('${date}T$time:00');
  bool get cancelled => status == 'cancelled';
  bool get past => (startsAt ?? DateTime(2000)).add(const Duration(hours: 1)).isBefore(DateTime.now());
  static ChatMeeting? maybe(Object? j) => j is Map ? ChatMeeting.fromJson(Map<String, dynamic>.from(j)) : null;
  factory ChatMeeting.fromJson(Map<String, dynamic> j) => ChatMeeting(
      id: '${j['id'] ?? ''}', threadId: '${j['threadId'] ?? ''}', date: '${j['date'] ?? ''}', time: '${j['time'] ?? ''}', link: '${j['link'] ?? ''}', note: '${j['note'] ?? ''}',
      status: '${j['status'] ?? 'scheduled'}', createdAt: '${j['createdAt'] ?? ''}', updatedAt: '${j['updatedAt'] ?? ''}');
  Map<String, dynamic> toJson() => {'id': id, 'threadId': threadId, 'date': date, 'time': time, 'link': link, 'note': note, 'status': status, 'createdAt': createdAt, 'updatedAt': updatedAt};
  ChatMeeting copyWith({String? id, String? date, String? time, String? link, String? note, String? status, String? updatedAt}) => ChatMeeting(
      id: id ?? this.id, threadId: threadId, date: date ?? this.date, time: time ?? this.time, link: link ?? this.link, note: note ?? this.note,
      status: status ?? this.status, createdAt: createdAt, updatedAt: updatedAt ?? this.updatedAt);
  @override
  List<Object?> get props => [id, threadId, date, time, link, note, status, createdAt, updatedAt];
}

/// One message inside a thread. [from] is `me` or `them`. A message carries text, an [attach]ment
/// (image / file / voice note) or a [meeting] card.
class ThreadMessage extends Equatable {
  const ThreadMessage({this.from = 'me', this.sender = 'Me', this.text = '', required this.ts, this.attach, this.meeting, this.read = true});
  final String from, sender, text, ts;
  final FileRef? attach;
  final ChatMeeting? meeting;
  final bool read;
  bool get mine => from == 'me';
  factory ThreadMessage.fromJson(Map<String, dynamic> j) => ThreadMessage(
      from: '${j['from'] ?? 'me'}', sender: '${j['sender'] ?? ''}', text: '${j['text'] ?? ''}', ts: '${j['ts'] ?? ''}', attach: FileRef.maybe(j['attach']),
      meeting: ChatMeeting.maybe(j['meeting']), read: j['read'] != false);
  Map<String, dynamic> toJson() => {'from': from, 'sender': sender, 'text': text, 'ts': ts, 'attach': attach?.toJson(), if (meeting != null) 'meeting': meeting!.toJson(), 'read': read};
  ThreadMessage copyWith({bool? read}) => ThreadMessage(from: from, sender: sender, text: text, ts: ts, attach: attach, meeting: meeting, read: read ?? this.read);
  @override
  List<Object?> get props => [from, sender, text, ts, attach, meeting, read];
}

/// A conversation — collection `ms_messages`. [unread] stays an integer (the More tab sums it).
class MessageThread extends Equatable {
  const MessageThread({this.id = '', required this.key, required this.name, this.role = '', this.kind = 'parent', this.pinned = false, this.online = false, this.unread = 0, this.subject = '', this.members = 0, this.msgs = const [], this.phone = '', this.studentId = ''});
  /// The guardian's phone (from the student record) for the call button; empty for staff and groups.
  final String id, key, name, role, kind, subject, phone, studentId;
  final bool pinned, online;
  final int unread, members;
  final List<ThreadMessage> msgs;

  bool get broadcast => kind == 'broadcast';
  ThreadMessage? get last => msgs.isEmpty ? null : msgs.last;
  bool get hasAttachment => msgs.any((m) => m.attach != null);
  DateTime get lastAt => DateTime.tryParse(last?.ts ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

  factory MessageThread.fromJson(Map<String, dynamic> j) => MessageThread(
        id: '${j['id'] ?? ''}', key: '${j['key'] ?? ''}', name: '${j['name'] ?? ''}', role: '${j['role'] ?? ''}', kind: '${j['kind'] ?? 'parent'}', pinned: j['pinned'] == true,
        online: j['online'] == true, unread: (j['unread'] as num?)?.toInt() ?? 0, subject: '${j['subject'] ?? ''}', members: (j['members'] as num?)?.toInt() ?? 0,
        phone: '${j['phone'] ?? ''}', studentId: '${j['studentId'] ?? ''}',
        msgs: [for (final m in (j['msgs'] as List? ?? const [])) ThreadMessage.fromJson(Map<String, dynamic>.from(m as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'key': key, 'name': name, 'role': role, 'kind': kind, 'pinned': pinned, 'online': online, 'unread': unread, 'subject': subject, 'members': members,
        if (phone.isNotEmpty) 'phone': phone, if (studentId.isNotEmpty) 'studentId': studentId,
        'msgs': [for (final m in msgs) m.toJson()],
      };
  MessageThread copyWith({bool? pinned, int? unread, String? subject, List<ThreadMessage>? msgs}) => MessageThread(
        id: id, key: key, name: name, role: role, kind: kind, pinned: pinned ?? this.pinned, online: online, unread: unread ?? this.unread,
        subject: subject ?? this.subject, members: members, msgs: msgs ?? this.msgs, phone: phone, studentId: studentId,
      );

  @override
  List<Object?> get props => [id, key, name, role, kind, pinned, online, unread, subject, members, msgs, phone, studentId];
}

/// A saved, unsent message — collection `ms_drafts`.
class MessageDraft extends Equatable {
  const MessageDraft({this.id = '', this.to = const [], this.toLabel = '', this.role = '', this.sub = '', this.kind = 'parent', this.category = '', this.subject = '', this.body = '', this.ts = '', this.attach = const []});
  final String id, toLabel, role, sub, kind, category, subject, body, ts;
  final List<String> to;
  final List<FileRef> attach;
  factory MessageDraft.fromJson(Map<String, dynamic> j) => MessageDraft(
        id: '${j['id'] ?? ''}', to: [for (final e in (j['to'] as List? ?? const [])) '$e'], toLabel: '${j['toLabel'] ?? ''}', role: '${j['role'] ?? ''}', sub: '${j['sub'] ?? ''}',
        kind: '${j['kind'] ?? 'parent'}', category: '${j['category'] ?? ''}', subject: '${j['subject'] ?? ''}', body: '${j['body'] ?? ''}', ts: '${j['ts'] ?? ''}',
        attach: [for (final a in (j['attach'] as List? ?? const [])) FileRef.fromJson(Map<String, dynamic>.from(a as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'to': to, 'toLabel': toLabel, 'role': role, 'sub': sub, 'kind': kind, 'category': category, 'subject': subject, 'body': body, 'ts': ts,
        'attach': [for (final a in attach) a.toJson()],
      };
  MessageDraft copyWith({String? id, String? ts}) => MessageDraft.fromJson({...toJson(), 'id': ?id, 'ts': ?ts});
  @override
  List<Object?> get props => [id, to, toLabel, role, sub, kind, category, subject, body, ts, attach];
}
