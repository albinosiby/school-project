import '../../../core/bloc/child_data_bloc.dart';
import '../models/message_models.dart';
import '../repositories/message_repository_interface.dart';

export 'threads_events.dart';
export 'threads_states.dart';

class ThreadsBloc extends ChildDataBloc<List<MessageThread>> {
  ThreadsBloc(IMessageRepository repo) : super(repo.watchThreads);
}
