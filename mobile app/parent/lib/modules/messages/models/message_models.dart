import 'package:equatable/equatable.dart';

/// Who is on the other side of a conversation. Drives the list filter tab, the role badge colour
/// and the avatar (people get initials, offices get an icon).
enum ContactKind {
  classTeacher,
  subjectTeacher,
  leadership,
  accounts,
  transport;

  bool get isPerson => this != accounts && this != transport;

  MessageFilter get filter => switch (this) {
    classTeacher || subjectTeacher => MessageFilter.teachers,
    leadership || accounts => MessageFilter.administration,
    transport => MessageFilter.transport,
  };
}

/// Filter tabs of the Messages list (Figma 4).
enum MessageFilter {
  all('All Messages'),
  teachers('Teachers'),
  administration('Administration'),
  transport('Transport'),
  unread('Unread');

  const MessageFilter(this.label);
  final String label;
}

/// "Message context" chips of New Message (Figma 4.2).
enum MessageCategory {
  academic('Academic Query'),
  leave('Leave / Absence'),
  fees('Fees & Admin'),
  ptm('PTM Request');

  const MessageCategory(this.label);
  final String label;
}

/// Someone the guardian can write to (teacher, office, helpdesk).
class MessageContact extends Equatable {
  const MessageContact({
    required this.id,
    required this.name,
    required this.shortName,
    required this.role,
    required this.badge,
    required this.kind,
    this.online = false,
  });
  final String id, name, shortName;

  /// Line under the name, e.g. "Class 10-B • Mathematics PGT".
  final String role;

  /// Short tag shown next to the name, e.g. "Class Teacher", "Accounts & Billing".
  final String badge;
  final ContactKind kind;
  final bool online;

  /// "Ma'am" / "Sir" for quick replies.
  String get salutation {
    final n = name.toLowerCase();
    if (n.startsWith('mrs') || n.startsWith('ms')) return "Ma'am";
    if (n.startsWith('mr') || n.startsWith('dr')) return 'Sir';
    return 'team';
  }

  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return name.toLowerCase().contains(q) ||
        role.toLowerCase().contains(q) ||
        badge.toLowerCase().contains(q);
  }

  @override
  List<Object?> get props => [id, name, shortName, role, badge, kind, online];
}

/// A file attached to a message (simulated upload).
class MessageAttachment extends Equatable {
  const MessageAttachment({required this.name, required this.sizeKb});
  final String name;
  final int sizeKb;

  String get sizeLabel => sizeKb >= 1024
      ? '${(sizeKb / 1024).toStringAsFixed(1)} MB'
      : '$sizeKb KB';

  @override
  List<Object?> get props => [name, sizeKb];
}

class MessageThread extends Equatable {
  const MessageThread({
    required this.id,
    required this.childId,
    required this.teacher,
    required this.role,
    required this.lastMessage,
    required this.lastAt,
    this.unread = 0,
    this.contactId = '',
    this.subtitle = '',
    this.kind = ContactKind.subjectTeacher,
    this.subject,
    this.pinned = false,
    this.verified = false,
    this.online = false,
  });
  final String id, childId, contactId;

  /// Name of the teacher / office.
  final String teacher;

  /// Role badge ("Class Teacher", "Leadership"...).
  final String role;

  /// Line under the name ("Class 10-B • Mathematics PGT").
  final String subtitle;
  final String lastMessage;
  final DateTime lastAt;
  final int unread;
  final ContactKind kind;
  final String? subject;
  final bool pinned, verified, online;

  MessageThread copyWith({
    String? lastMessage,
    DateTime? lastAt,
    int? unread,
    bool? pinned,
  }) => MessageThread(
    id: id,
    childId: childId,
    teacher: teacher,
    role: role,
    lastMessage: lastMessage ?? this.lastMessage,
    lastAt: lastAt ?? this.lastAt,
    unread: unread ?? this.unread,
    contactId: contactId,
    subtitle: subtitle,
    kind: kind,
    subject: subject,
    pinned: pinned ?? this.pinned,
    verified: verified,
    online: online,
  );

  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return [
      teacher,
      role,
      subtitle,
      lastMessage,
      ?subject,
    ].any((s) => s.toLowerCase().contains(q));
  }

  @override
  List<Object?> get props => [
    id,
    childId,
    contactId,
    teacher,
    role,
    subtitle,
    lastMessage,
    lastAt,
    unread,
    kind,
    subject,
    pinned,
    verified,
    online,
  ];
}

class ChatMessage extends Equatable {
  const ChatMessage({
    required this.id,
    required this.threadId,
    required this.fromParent,
    required this.text,
    required this.at,
    this.attachments = const [],
    this.read = true,
  });
  final String id, threadId, text;
  final bool fromParent;
  final DateTime at;
  final List<MessageAttachment> attachments;

  /// For the guardian's own messages: seen by the teacher (double tick).
  final bool read;

  @override
  List<Object?> get props => [
    id,
    threadId,
    fromParent,
    text,
    at,
    attachments,
    read,
  ];
}

/// Thread header + messages (chat screen).
class Conversation extends Equatable {
  const Conversation({required this.thread, required this.messages});
  final MessageThread thread;
  final List<ChatMessage> messages;
  @override
  List<Object?> get props => [thread, messages];
}

/// An unsent New Message.
class MessageDraft extends Equatable {
  const MessageDraft({
    required this.id,
    required this.childId,
    required this.updatedAt,
    this.contactId,
    this.category = MessageCategory.academic,
    this.subject = '',
    this.body = '',
    this.attachments = const [],
  });
  final String id, childId;
  final String? contactId;
  final MessageCategory category;
  final String subject, body;
  final List<MessageAttachment> attachments;
  final DateTime updatedAt;

  String get title => subject.trim().isEmpty ? '(No subject)' : subject.trim();

  @override
  List<Object?> get props => [
    id,
    childId,
    contactId,
    category,
    subject,
    body,
    attachments,
    updatedAt,
  ];
}

/// Messages tab data: threads (pinned first, newest first) and drafts.
class MessagesOverview extends Equatable {
  const MessagesOverview({required this.threads, this.drafts = const []});
  final List<MessageThread> threads;
  final List<MessageDraft> drafts;

  /// Number of conversations with unread messages.
  int get unreadThreads => threads.where((t) => t.unread > 0).length;

  /// Total unread messages.
  int get unreadMessages => threads.fold(0, (a, t) => a + t.unread);

  int countFor(MessageFilter f) => filterThreads(threads, filter: f).length;

  @override
  List<Object?> get props => [threads, drafts];
}

/// Search + filter tab of the Messages list. Keeps the incoming order.
List<MessageThread> filterThreads(
  List<MessageThread> threads, {
  String query = '',
  MessageFilter filter = MessageFilter.all,
}) => [
  for (final t in threads)
    if (t.matches(query) &&
        switch (filter) {
          MessageFilter.all => true,
          MessageFilter.unread => t.unread > 0,
          _ => t.kind.filter == filter,
        })
      t,
];

/// Pinned first, then newest first.
List<MessageThread> sortThreads(List<MessageThread> threads) =>
    [...threads]..sort((a, b) {
      if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
      return b.lastAt.compareTo(a.lastAt);
    });

/// What the New Message form sends.
class NewMessageRequest extends Equatable {
  const NewMessageRequest({
    required this.childId,
    required this.contactId,
    required this.category,
    required this.subject,
    required this.body,
    this.attachments = const [],
    this.draftId,
  });
  final String childId, contactId, subject, body;
  final MessageCategory category;
  final List<MessageAttachment> attachments;

  /// Sending a draft removes it.
  final String? draftId;

  static const subjectMax = 80;
  static const bodyMax = 800;

  static String? validateSubject(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Add a subject';
    if (s.length < 4) return 'Subject is too short';
    if (s.length > subjectMax)
      return 'Keep the subject under $subjectMax characters';
    return null;
  }

  static String? validateBody(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Write your message';
    if (s.length < 10)
      return 'Please add a little more detail (10+ characters)';
    if (s.length > bodyMax) return 'Message is limited to $bodyMax characters';
    return null;
  }

  /// First validation error, or null when the request can be sent.
  String? get error => contactId.isEmpty
      ? 'Choose who to send this to'
      : (validateSubject(subject) ?? validateBody(body));

  @override
  List<Object?> get props => [
    childId,
    contactId,
    category,
    subject,
    body,
    attachments,
    draftId,
  ];
}
