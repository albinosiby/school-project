import 'package:equatable/equatable.dart';
import '../models/message_models.dart';
import 'engage_notice.dart';

class MessagesState extends Equatable implements NoticeState {
  const MessagesState({this.status = EngageStatus.initial, this.threads = const [], this.drafts = const [], this.recipients = const [], this.meetings = const [], this.uploading = 0, this.pending = const {}, this.notice, this.error});
  final EngageStatus status;
  final List<MessageThread> threads;
  final List<MessageDraft> drafts;
  /// Meetings scheduled from chats (all threads).
  final List<ChatMeeting> meetings;
  /// Attachments / voice notes currently being uploaded.
  final int uploading;
  /// Per thread: attachments shown as "sending" bubbles until their upload and message land (local paths).
  final Map<String, List<ThreadMessage>> pending;
  List<ThreadMessage> pendingOf(String threadId) => pending[threadId] ?? const [];

  /// Saved contacts first, then every guardian and student.
  final List<Recipient> recipients;
  @override
  final Notice? notice;
  final String? error;

  List<Recipient> get contacts => recipients.where((r) => !r.id.startsWith('stu_') && !r.id.startsWith('g_')).toList();
  int get unreadThreads => threads.where((t) => t.unread > 0).length;
  /// The thread by id, or by recipient key (`g_<studentId>` / contact id) for a chat opened from the contact list.
  MessageThread? thread(String id) => threads.where((t) => t.id == id).firstOrNull ?? threads.where((t) => t.key == id).firstOrNull;
  MessageDraft? draft(String id) => drafts.where((d) => d.id == id).firstOrNull;
  Recipient? recipient(String id) => recipients.where((r) => r.id == id).firstOrNull;
  ChatMeeting? meeting(String id) => meetings.where((m) => m.id == id).firstOrNull;
  /// Live meetings of a thread (scheduled, not yet over), soonest first.
  List<ChatMeeting> upcomingMeetings(String threadId) =>
      (meetings.where((m) => m.threadId == threadId && !m.cancelled && !m.past).toList()..sort((a, b) => '${a.date}T${a.time}'.compareTo('${b.date}T${b.time}')));

  /// Drafts, newest first.
  List<MessageDraft> get sortedDrafts => [...drafts]..sort((a, b) => b.ts.compareTo(a.ts));

  MessagesState copyWith({EngageStatus? status, List<MessageThread>? threads, List<MessageDraft>? drafts, List<Recipient>? recipients, List<ChatMeeting>? meetings, int? uploading, Map<String, List<ThreadMessage>>? pending, Notice? notice, String? error}) => MessagesState(
        status: status ?? this.status, threads: threads ?? this.threads, drafts: drafts ?? this.drafts, recipients: recipients ?? this.recipients,
        meetings: meetings ?? this.meetings, uploading: uploading ?? this.uploading, pending: pending ?? this.pending, notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, threads, drafts, recipients, meetings, uploading, pending, notice, error];
}
