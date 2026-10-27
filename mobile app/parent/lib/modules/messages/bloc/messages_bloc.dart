import 'package:bloc_concurrency/bloc_concurrency.dart';
import '../../../core/bloc/child_data_bloc.dart';
import '../models/message_models.dart';
import '../repositories/message_repository_interface.dart';
import 'messages_events.dart';

export 'messages_events.dart';
export 'messages_states.dart';

/// Messages tab: threads + drafts of the selected child (cache-first). Writes go through the
/// repository, which pushes the fresh overview back through the same stream.
class MessagesBloc extends ChildDataBloc<MessagesOverview> {
  MessagesBloc(this._repo) : super(_repo.watchOverview) {
    on<PinThread>(
      (e, _) => _repo.setPinned(e.threadId, e.pinned),
      transformer: sequential(),
    );
    on<MarkThreadRead>((e, _) => _repo.markRead(e.threadId));
    on<MarkAllThreadsRead>((e, _) async {
      final id = state.childId;
      if (id != null) await _repo.markAllRead(id);
    });
    on<DeleteDraft>((e, _) => _repo.deleteDraft(e.draftId));
  }

  final IMessageRepository _repo;
}

/// Unread conversations of the selected child (tab badge / home card).
class UnreadCountBloc extends ChildDataBloc<int> {
  UnreadCountBloc(IMessageRepository repo) : super(repo.watchUnreadCount);
}
