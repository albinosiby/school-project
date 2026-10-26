import '../../../core/bloc/child_data_bloc.dart';
import '../models/notice_models.dart';
import '../repositories/notice_repository_interface.dart';
import 'notices_events.dart';

export 'notices_events.dart';
export 'notices_states.dart';

class NoticesBloc extends ChildDataBloc<List<Notice>> {
  NoticesBloc(this._repo) : super(_repo.watchNotices) {
    // The repository stream pushes the updated list, so the UI updates itself.
    on<AcknowledgeNotice>((event, emit) => _repo.acknowledge(event.noticeId));
  }

  final INoticeRepository _repo;
}
