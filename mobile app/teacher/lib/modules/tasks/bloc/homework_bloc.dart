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
    on<HomeworkAllMarkedIn>(_onAllIn);
    on<HomeworkDeleted>(_onDeleted);
    _subs = [
      for (final s in [_homework.watch(), _school.watch()]) s.listen((_) {
        if (state.id.isNotEmpty && state.status != HomeworkStatus.deleted) add(HomeworkLoadRequested(state.id));
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
    // closed → reopened, scheduled → published now, open → closed
    if (h != null) await _homework.update(h.copyWith(status: h.status == 'closed' || h.status == 'scheduled' ? 'open' : 'closed'));
  }

  Future<void> _onSubmitted(HomeworkSubmissionMarked e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    final old = h.submissions[e.studentId] ?? const Submission();
    final sub = e.handedIn
        ? Submission(status: SubmissionStatus.submitted, marks: old.marks, feedback: old.feedback, gradedAt: old.gradedAt, extra: old.extra)
        : Submission(extra: {...old.extra}..remove('gradedBy'));
    await _homework.update(h.copyWith(submissions: {...h.submissions, e.studentId: sub}));
  }

  Future<void> _onAllIn(HomeworkAllMarkedIn e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    final subs = {...h.submissions};
    for (final s in state.students) {
      final cur = subs[s.id] ?? const Submission();
      if (cur.status == SubmissionStatus.pending) subs[s.id] = Submission(status: SubmissionStatus.submitted, extra: cur.extra);
    }
    await _homework.update(h.copyWith(submissions: subs));
  }

  Future<void> _onGrade(HomeworkGradeSaved e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    final old = h.submissions[e.studentId] ?? const Submission();
    final sub = Submission(
      status: SubmissionStatus.graded,
      marks: e.marks,
      feedback: e.feedback.trim(),
      gradedAt: DateTime.now().toIso8601String(),
      extra: {
        ...old.extra,
        'gradedBy': state.teacher?.name,
        if (old.status == SubmissionStatus.graded && old.marks != e.marks) 'previousMarks': old.marks,
      },
    );
    await _homework.update(h.copyWith(submissions: {...h.submissions, e.studentId: sub}));
    emit(state.copyWith(savedSeq: state.savedSeq + 1));
  }

  Future<void> _onDeleted(HomeworkDeleted e, Emitter<HomeworkState> emit) async {
    final h = state.homework;
    if (h == null) return;
    await _homework.delete(h.id);
    emit(state.copyWith(status: HomeworkStatus.deleted));
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      s.cancel();
    }
    return super.close();
  }
}
