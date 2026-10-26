import 'package:equatable/equatable.dart';
import '../models/message_models.dart';

sealed class NewMessageEvent extends Equatable {
  const NewMessageEvent();
  @override
  List<Object?> get props => [];
}

/// Load recipients for [childId]; optionally reopen [draftId] or preselect [contactId].
class NewMessageStarted extends NewMessageEvent {
  const NewMessageStarted(this.childId, {this.draftId, this.contactId});
  final String childId;
  final String? draftId, contactId;
  @override
  List<Object?> get props => [childId, draftId, contactId];
}

class NewMessageSubmitted extends NewMessageEvent {
  const NewMessageSubmitted(this.request);
  final NewMessageRequest request;
  @override
  List<Object?> get props => [request];
}

class NewMessageDraftSaved extends NewMessageEvent {
  const NewMessageDraftSaved(this.draft);
  final MessageDraft draft;
  @override
  List<Object?> get props => [draft];
}
