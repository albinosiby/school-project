import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../engage/models/attachment_models.dart';
import '../../engage/repositories/chat_media_repository.dart';
import '../../home/repositories/timetable_repository_interface.dart';
import '../models/lesson_plan_models.dart';
import '../repositories/lesson_plan_repository_interface.dart';
import '../screens/widgets/lesson_plan_widgets.dart' show periodPassed;
import 'lesson_plans_events.dart';
import 'lesson_plans_states.dart';
import 'lessons_notice.dart';

/// Lesson plans: list, plan, editor. Reloads when `ls_plans` changes; the timetable feeds the session date suggestions.
class LessonPlansBloc extends Bloc<LessonPlansEvent, LessonPlansState> {
  LessonPlansBloc(this._repo, [this._timetable, this._media]) : super(const LessonPlansState()) {
    on<LessonPlansLoadRequested>(_onLoad);
    on<LessonSessionMarked>(_onMark);
    on<LessonPlanDeleted>(_onDelete);
    on<LessonPlanSaved>(_onSave);
    on<LessonPlanCopied>(_onCopy);
    on<LessonPlanReviewRequested>(_onReview);
    _sub = _repo.watch().listen((_) => add(const LessonPlansLoadRequested()));
  }

  final ILessonPlanRepository _repo;
  final ITimetableRepository? _timetable;
  final IChatMediaRepository? _media;
  late final StreamSubscription<void> _sub;
  int _n = 0;

  Notice _notice(String m, [NoticeAction a = NoticeAction.none]) => Notice(++_n, m, action: a);
  static String _now() => DateTime.now().toIso8601String();

  Future<void> _onLoad(LessonPlansLoadRequested e, Emitter<LessonPlansState> emit) async {
    if (state.status == LessonPlansStatus.initial) emit(state.copyWith(status: LessonPlansStatus.loading));
    try {
      final plans = await _repo.getAll();
      final periods = state.periods.isEmpty && _timetable != null ? await _timetable.getPeriods() : state.periods;
      emit(state.copyWith(status: LessonPlansStatus.loaded, plans: plans, periods: periods));
    } on AppException catch (err) {
      emit(state.copyWith(status: LessonPlansStatus.failure, error: err.message));
    }
  }

  Future<void> _onMark(LessonSessionMarked e, Emitter<LessonPlansState> emit) async {
    final p = state.byId(e.planId) ?? await _repo.get(e.planId);
    if (p == null) return;
    final sessions = [
      for (final s in p.sessions)
        s.id == e.sessionId
            ? s.copyWith(
                status: e.status,
                note: e.note ?? s.note,
                taughtAt: e.status == SessionStatus.taught ? _now() : '',
              )
            : s,
    ];
    final next = p.copyWith(sessions: sessions);
    await _repo.update(next);
    final msg = switch (e.status) {
      SessionStatus.taught => next.completed ? 'All sessions taught — plan completed' : 'Marked as taught',
      SessionStatus.skipped => 'Session skipped',
      SessionStatus.planned => 'Session reopened',
    };
    emit(state.copyWith(notice: _notice(msg)));
  }

  Future<void> _onDelete(LessonPlanDeleted e, Emitter<LessonPlansState> emit) async {
    await _repo.delete(e.id);
    emit(state.copyWith(notice: _notice('Lesson plan deleted', NoticeAction.pop)));
  }

  Future<void> _onSave(LessonPlanSaved e, Emitter<LessonPlansState> emit) async {
    var p = e.plan;
    if (e.files.isNotEmpty && _media != null) {
      emit(state.copyWith(uploading: true));
      final added = <FileRef>[];
      for (final f in e.files) {
        try {
          added.add(await _media.uploadMaterial(path: f.path, name: f.name, folder: 'lesson-plans'));
        } catch (_) {}
      }
      emit(state.copyWith(uploading: false));
      if (added.length < e.files.length) {
        emit(state.copyWith(notice: _notice('${e.files.length - added.length} file(s) could not be uploaded')));
        if (added.isEmpty) return;
      }
      p = p.copyWith(attachments: [...p.attachments, ...added]);
    }
    if (p.id.isEmpty) {
      await _repo.create(p.copyWith(code: _code(p)));
    } else {
      await _repo.update(p);
    }
    emit(state.copyWith(notice: _notice(p.draft ? 'Saved as draft' : 'Lesson plan saved', NoticeAction.pop)));
  }

  Future<void> _onCopy(LessonPlanCopied e, Emitter<LessonPlansState> emit) async {
    final p = state.byId(e.planId) ?? await _repo.get(e.planId);
    if (p == null) return;
    final dates = suggestSessionDates(
      periods: state.slotsFor(e.cls, p.subject),
      from: todayIso(),
      count: p.sessions.length,
      skip: periodPassed,
    );
    final sessions = [
      for (var i = 0; i < p.sessions.length; i++)
        LessonSession(
          id: 's${i + 1}',
          date: i < dates.length ? dates[i].date : '',
          slot: i < dates.length ? dates[i].slot : '',
          focus: p.sessions[i].focus,
          activities: p.sessions[i].activities,
          homework: p.sessions[i].homework,
        ),
    ];
    final copy = p.copyWith(
      id: '',
      cls: e.cls,
      classId: e.classId,
      sessions: sessions,
      draft: true,
      review: const LessonReview(),
      copiedFrom: p.id,
    );
    await _repo.create(copy.copyWith(code: _code(copy)));
    emit(state.copyWith(notice: _notice('Copied to ${e.cls} as a draft')));
  }

  Future<void> _onReview(LessonPlanReviewRequested e, Emitter<LessonPlansState> emit) async {
    final p = state.byId(e.planId) ?? await _repo.get(e.planId);
    if (p == null) return;
    await _repo.update(
      p.copyWith(
        draft: false,
        review: LessonReview(state: ReviewState.submitted, submittedAt: _now()),
      ),
    );
    emit(state.copyWith(notice: _notice('Sent for review')));
  }

  String _code(LessonPlan p) {
    final n = state.plans.where((x) => x.subject == p.subject).length + 1;
    return 'LP-${p.subject.isEmpty ? 'X' : p.subject[0].toUpperCase()}${p.cls.replaceAll('-', '')}-${n.toString().padLeft(2, '0')}';
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
