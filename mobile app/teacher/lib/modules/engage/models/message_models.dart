import 'package:equatable/equatable.dart';
import 'attachment_models.dart';

/// Someone a message can be sent to: a saved contact (`ms_contacts`), a student or a guardian (`g_<studentId>`).
/// [kind] is parent / staff / student / broadcast.
class Recipient extends Equatable {
  const Recipient({required this.id, required this.name, this.role = '', this.kind = 'parent', this.sub = '', this.extra = '', this.online = false});
  final String id, name, role, kind, sub, extra;
  final bool online;
  bool get broadcast => kind == 'broadcast';
  factory Recipient.fromJson(Map<String, dynamic> j) => Recipient(
      id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', role: '${j['role'] ?? ''}', kind: '${j['kind'] ?? 'parent'}', sub: '${j['sub'] ?? ''}', extra: '${j['extra'] ?? ''}', online: j['online'] == true);
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role, 'kind': kind, 'sub': sub, 'extra': extra, 'online': online};
  Recipient copyWith({bool? online}) => Recipient.fromJson({...toJson(), 'online': ?online});
  @override
  List<Object?> get props => [id, name, role, kind, sub, extra, online];
}

/// One message inside a thread. [from] is `me` or `them`.
class ThreadMessage extends Equatable {
  const ThreadMessage({this.from = 'me', this.sender = 'Me', this.text = '', required this.ts, this.attach, this.read = true});
  final String from, sender, text, ts;
  final FileRef? attach;
  final bool read;
  bool get mine => from == 'me';
  factory ThreadMessage.fromJson(Map<String, dynamic> j) => ThreadMessage(
      from: '${j['from'] ?? 'me'}', sender: '${j['sender'] ?? ''}', text: '${j['text'] ?? ''}', ts: '${j['ts'] ?? ''}', attach: FileRef.maybe(j['attach']), read: j['read'] != false);
  Map<String, dynamic> toJson() => {'from': from, 'sender': sender, 'text': text, 'ts': ts, 'attach': attach?.toJson(), 'read': read};
  ThreadMessage copyWith({bool? read}) => ThreadMessage(from: from, sender: sender, text: text, ts: ts, attach: attach, read: read ?? this.read);
  @override
  List<Object?> get props => [from, sender, text, ts, attach, read];
}

/// A conversation — collection `ms_messages`. [unread] stays an integer (the More tab sums it).
class MessageThread extends Equatable {
  const MessageThread({this.id = '', required this.key, required this.name, this.role = '', this.kind = 'parent', this.pinned = false, this.online = false, this.unread = 0, this.subject = '', this.members = 0, this.msgs = const []});
  final String id, key, name, role, kind, subject;
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
        msgs: [for (final m in (j['msgs'] as List? ?? const [])) ThreadMessage.fromJson(Map<String, dynamic>.from(m as Map))],
      );
  Map<String, dynamic> toJson() => {
        'id': id, 'key': key, 'name': name, 'role': role, 'kind': kind, 'pinned': pinned, 'online': online, 'unread': unread, 'subject': subject, 'members': members,
        'msgs': [for (final m in msgs) m.toJson()],
      };
  MessageThread copyWith({bool? pinned, int? unread, String? subject, List<ThreadMessage>? msgs}) => MessageThread(
        id: id, key: key, name: name, role: role, kind: kind, pinned: pinned ?? this.pinned, online: online, unread: unread ?? this.unread,
        subject: subject ?? this.subject, members: members, msgs: msgs ?? this.msgs,
      );

  @override
  List<Object?> get props => [id, key, name, role, kind, pinned, online, unread, subject, members, msgs];
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
