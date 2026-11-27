import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/repositories/chat_media_repository.dart';
import '../../tasks/repositories/homework_repository_interface.dart';
import 'new_homework_events.dart';
import 'new_homework_states.dart';

/// Set (or edit) homework for a class. Attachments are uploaded to the teacher's homework-materials folder.
class NewHomeworkBloc extends Bloc<NewHomeworkEvent, NewHomeworkState> {
  NewHomeworkBloc(this._repo, [this._media]) : super(const NewHomeworkState()) {
    on<NewHomeworkLoadRequested>(_onLoad);
    on<NewHomeworkSubmitted>(_onSubmit);
  }

  final IHomeworkRepository _repo;
  final IChatMediaRepository? _media;

  Future<void> _onLoad(NewHomeworkLoadRequested e, Emitter<NewHomeworkState> emit) async {
    final all = await _repo.getAll();
    emit(state.copyWith(
      status: NewHomeworkStatus.ready,
      existing: all,
      editing: e.editId == null ? null : all.where((h) => h.id == e.editId).firstOrNull,
    ));
  }

  Future<void> _onSubmit(NewHomeworkSubmitted e, Emitter<NewHomeworkState> emit) async {
    emit(state.copyWith(status: NewHomeworkStatus.saving));
    try {
      var hw = e.homework;
      if (e.files.isNotEmpty) {
        final media = _media;
        if (media == null) throw AppException(message: 'Attachments are not available here.');
        final added = <FileRef>[];
        for (final f in e.files) {
          added.add(await media.uploadMaterial(path: f.path, name: f.name, folder: 'homework-materials'));
        }
        hw = hw.copyWith(extra: {
          ...hw.extra,
          'attachments': [...(hw.extra['attachments'] as List? ?? const []), for (final a in added) a.toJson()],
        });
      }
      final editing = hw.id.isNotEmpty;
      if (editing) {
        await _repo.update(hw);
      } else {
        hw = await _repo.create(hw);
      }
      emit(state.copyWith(
        status: NewHomeworkStatus.saved,
        saved: hw,
        message: editing
            ? 'Homework updated'
            : hw.status == 'scheduled'
            ? 'Homework scheduled — parents are notified when it is published'
            : 'Homework set for ${e.enrolled} students — parents are notified',
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: NewHomeworkStatus.failure, message: err.message));
    } catch (_) {
      emit(state.copyWith(status: NewHomeworkStatus.failure, message: 'Could not save the homework. Check your connection.'));
    }
  }
}
