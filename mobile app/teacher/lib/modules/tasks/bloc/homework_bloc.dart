import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../models/homework_models.dart';
import '../repositories/homework_repository_interface.dart';
import 'homework_events.dart';
import 'homework_states.dart';

/// Open homework (rubric), graded list and grade editor for one homework.
class HomeworkBloc extends Bloc<HomeworkEvent, HomeworkState> {
  HomeworkBloc(this._homework, this._school) : super(const HomeworkState()) {
    on<HomeworkLoadRequested>(_onLoad);
    on<HomeworkStatusToggled>(_onToggle);
    on<HomeworkSubmissionMarked>(_onSubmitted);
    on<HomeworkGradeSaved>(_onGrade);
    _subs = [
      for (final s in [_homework.watch(), _school.watch()]) s.listen((_) {
        if (state.id.isNotEmpty) add(HomeworkLoadRequested(state.id));
      }),
    ];
  }

  final IHomeworkRepository _homework;
  final ISchoolRepository _school;
  late final List<StreamSubscription<void>> _subs;

  Future<void> _onLoad(HomeworkLoadRequested e, Emitter<HomeworkState> emit) async {
    if (state.status == HomeworkStatus.initial) emit(state.copyWith(status: HomeworkStatus.loading, id: e.id));
    try {
      final h = await _homework.get(e.id);
      if (h == null) {
        emit(state.copyWith(status: HomeworkStatus.notFound, id: e.id));
        return;
      }
      final classes = await _school.getClasses();
      emit(state.copyWith(
        status: HomeworkStatus.loaded, id: e.id, homework: h,
        students: await _school.getStudents(classId: h.classId),
        schoolClass: classes.where((c) => c.id == h.classId).firstOrNull,
        teacher: await _school.getTeacher(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: HomeworkStatus.failure, error: err.message));
    }
  }

  Future<void> _onToggle(HomeworkStatusToggled e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h != null) await _homework.update(h.copyWith(status: h.status == 'closed' ? 'open' : 'closed'));
  }

  Future<void> _onSubmitted(HomeworkSubmissionMarked e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    final old = h.submissions[e.studentId] ?? const Submission();
    final sub = Submission(status: SubmissionStatus.submitted, marks: old.marks, feedback: old.feedback, gradedAt: old.gradedAt, extra: old.extra);
    await _homework.update(h.copyWith(submissions: {...h.submissions, e.studentId: sub}));
  }

  Future<void> _onGrade(HomeworkGradeSaved e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    final old = h.submissions[e.studentId] ?? const Submission();
    final wasGraded = old.status == SubmissionStatus.graded;
    final sub = Submission(
      status: SubmissionStatus.graded, marks: e.criteria.fold<int>(0, (a, b) => a + b), feedback: e.feedback, gradedAt: DateTime.now().toIso8601String(),
      extra: {
        ...old.extra, 'criteria': e.criteria, 'gradedBy': state.teacher?.name,
        if (wasGraded) 'rationale': e.rationale, if (wasGraded) 'previousMarks': old.marks,
      },
    );
    await _homework.update(h.copyWith(submissions: {...h.submissions, e.studentId: sub}));
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
