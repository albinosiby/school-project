import 'package:equatable/equatable.dart';
import '../models/message_models.dart';
import 'engage_notice.dart';

class MessagesState extends Equatable implements NoticeState {
  const MessagesState({this.status = EngageStatus.initial, this.threads = const [], this.drafts = const [], this.recipients = const [], this.notice, this.error});
  final EngageStatus status;
  final List<MessageThread> threads;
  final List<MessageDraft> drafts;

  /// Saved contacts first, then every guardian and student.
  final List<Recipient> recipients;
  @override
  final Notice? notice;
  final String? error;

  List<Recipient> get contacts => recipients.where((r) => !r.id.startsWith('stu_') && !r.id.startsWith('g_')).toList();
  int get unreadThreads => threads.where((t) => t.unread > 0).length;
  MessageThread? thread(String id) => threads.where((t) => t.id == id).firstOrNull;
  MessageDraft? draft(String id) => drafts.where((d) => d.id == id).firstOrNull;
  Recipient? recipient(String id) => recipients.where((r) => r.id == id).firstOrNull;

  /// Drafts, newest first.
  List<MessageDraft> get sortedDrafts => [...drafts]..sort((a, b) => b.ts.compareTo(a.ts));

  MessagesState copyWith({EngageStatus? status, List<MessageThread>? threads, List<MessageDraft>? drafts, List<Recipient>? recipients, Notice? notice, String? error}) => MessagesState(
        status: status ?? this.status, threads: threads ?? this.threads, drafts: drafts ?? this.drafts, recipients: recipients ?? this.recipients,
        notice: notice ?? this.notice, error: error,
      );

  @override
  List<Object?> get props => [status, threads, drafts, recipients, notice, error];
}
