import '../../../core/bloc/data_bloc.dart';
import '../models/notice_models.dart';
import '../repositories/notice_repository_interface.dart';

class NoticesBloc extends DataBloc<List<Notice>> {
  NoticesBloc(INoticeRepository repo) : super((_) => repo.watch());
}
