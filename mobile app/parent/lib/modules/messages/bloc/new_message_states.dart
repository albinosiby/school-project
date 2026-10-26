import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart' show LoadStatus;
import '../models/message_models.dart';

export '../../../core/bloc/child_data_bloc.dart' show LoadStatus;

enum SubmitStatus { idle, sending, sent, draftSaved, failed }

class NewMessageState extends Equatable {
  const NewMessageState({
    this.status = LoadStatus.loading,
    this.contacts = const [],
    this.draft,
    this.contactId,
    this.submit = SubmitStatus.idle,
    this.thread,
    this.error,
  });
  final LoadStatus status;
  final List<MessageContact> contacts;

  /// Draft being edited (prefills the form).
  final MessageDraft? draft;

  /// Recipient to preselect.
  final String? contactId;
  final SubmitStatus submit;

  /// Thread created by a successful send.
  final MessageThread? thread;
  final String? error;

  NewMessageState copyWith({
    LoadStatus? status,
    List<MessageContact>? contacts,
    MessageDraft? draft,
    SubmitStatus? submit,
    MessageThread? thread,
    String? error,
    bool clearError = false,
  }) => NewMessageState(
    status: status ?? this.status,
    contacts: contacts ?? this.contacts,
    draft: draft ?? this.draft,
    contactId: contactId,
    submit: submit ?? this.submit,
    thread: thread ?? this.thread,
    error: clearError ? null : (error ?? this.error),
  );

  @override
  List<Object?> get props => [
    status,
    contacts,
    draft,
    contactId,
    submit,
    thread,
    error,
  ];
}
