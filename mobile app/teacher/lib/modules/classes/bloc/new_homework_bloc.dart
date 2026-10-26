import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../tasks/repositories/homework_repository_interface.dart';
import 'new_homework_events.dart';
import 'new_homework_states.dart';

/// New Homework form. Homework is owned by the tasks module and is created only through [IHomeworkRepository].
class NewHomeworkBloc extends Bloc<NewHomeworkEvent, NewHomeworkState> {
  NewHomeworkBloc(this._repo) : super(const NewHomeworkState()) {
    on<NewHomeworkLoadRequested>(_onLoad);
    on<NewHomeworkSubmitted>(_onSubmit);
  }

  final IHomeworkRepository _repo;

  Future<void> _onLoad(NewHomeworkLoadRequested e, Emitter<NewHomeworkState> emit) async =>
      emit(state.copyWith(status: NewHomeworkStatus.ready, existing: await _repo.getAll()));

  Future<void> _onSubmit(NewHomeworkSubmitted e, Emitter<NewHomeworkState> emit) async {
    emit(state.copyWith(status: NewHomeworkStatus.saving));
    try {
      final hw = await _repo.create(e.homework);
      final draft = hw.status == 'draft';
      emit(state.copyWith(status: NewHomeworkStatus.saved, saved: hw, message: draft ? 'Draft saved' : 'Homework published to ${e.enrolled} students'));
    } on AppException catch (err) {
      emit(state.copyWith(status: NewHomeworkStatus.failure, message: err.message));
    }
  }
}
