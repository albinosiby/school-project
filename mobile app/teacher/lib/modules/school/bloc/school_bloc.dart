import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/cached_image_service.dart';
import '../repositories/school_repository_interface.dart';
import 'school_events.dart';
import 'school_states.dart';

/// App-wide BLoC (provided in main.dart) holding the teacher, classes and students.
/// Reloads automatically when the repository reports a change.
class SchoolBloc extends Bloc<SchoolEvent, SchoolState> {
  SchoolBloc(this._repo) : super(const SchoolState()) {
    on<SchoolLoadRequested>(_onLoad);
    on<TeacherUpdated>(_onTeacherUpdated);
    _sub = _repo.watch().listen((_) => add(const SchoolLoadRequested()));
  }

  final ISchoolRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(SchoolLoadRequested e, Emitter<SchoolState> emit) async {
    if (state.status == SchoolStatus.initial) emit(state.copyWith(status: SchoolStatus.loading));
    try {
      final teacher = await _repo.getTeacher();
      emit(state.copyWith(
        status: SchoolStatus.loaded,
        teacher: teacher,
        classes: await _repo.getClasses(),
        students: await _repo.getStudents(),
      ));
      // the school logo is fetched once here so the ID card shows it instantly
      if (teacher.logo.isNotEmpty) unawaited(CachedImageService.bytes(teacher.logo));
    } on AppException catch (err) {
      emit(state.copyWith(status: SchoolStatus.failure, error: err.message));
    }
  }

  Future<void> _onTeacherUpdated(TeacherUpdated e, Emitter<SchoolState> emit) => _repo.updateTeacher(e.teacher);

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
