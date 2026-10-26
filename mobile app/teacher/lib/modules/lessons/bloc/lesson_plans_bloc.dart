import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/lesson_plan_models.dart';
import '../repositories/lesson_plan_repository_interface.dart';
import 'lesson_plans_events.dart';
import 'lesson_plans_states.dart';
import 'lessons_notice.dart';

/// Lesson plans list, detail and editor. Reloads when `ls_plans` changes.
class LessonPlansBloc extends Bloc<LessonPlansEvent, LessonPlansState> {
  LessonPlansBloc(this._repo) : super(const LessonPlansState()) {
    on<LessonPlansLoadRequested>(_onLoad);
    on<LessonMilestoneToggled>(_onToggle);
    on<LessonPlanDeleted>(_onDelete);
    on<LessonPlanShared>(_onShare);
    on<LessonPlanSaved>(_onSave);
    _sub = _repo.watch().listen((_) => add(const LessonPlansLoadRequested()));
  }

  final ILessonPlanRepository _repo;
  late final StreamSubscription<void> _sub;
  int _n = 0;

  Notice _notice(String m, [NoticeAction a = NoticeAction.none]) => Notice(++_n, m, action: a);

  Future<void> _onLoad(LessonPlansLoadRequested e, Emitter<LessonPlansState> emit) async {
    if (state.status == LessonPlansStatus.initial) emit(state.copyWith(status: LessonPlansStatus.loading));
    try {
      emit(state.copyWith(status: LessonPlansStatus.loaded, plans: await _repo.getAll()));
    } on AppException catch (err) {
      emit(state.copyWith(status: LessonPlansStatus.failure, error: err.message));
    }
  }

  Future<void> _onToggle(LessonMilestoneToggled e, Emitter<LessonPlansState> emit) async {
    final p = state.byId(e.planId) ?? await _repo.get(e.planId);
    if (p == null || e.index < 0 || e.index >= p.milestones.length) return;
    final ms = [for (var i = 0; i < p.milestones.length; i++) i == e.index ? p.milestones[i].copyWith(done: !p.milestones[i].done) : p.milestones[i]];
    await _repo.update(p.copyWith(milestones: ms));
  }

  Future<void> _onDelete(LessonPlanDeleted e, Emitter<LessonPlansState> emit) async {
    await _repo.delete(e.id);
    emit(state.copyWith(notice: _notice('Lesson plan deleted', NoticeAction.pop)));
  }

  Future<void> _onShare(LessonPlanShared e, Emitter<LessonPlansState> emit) async {
    await _repo.share(e.id);
    emit(state.copyWith(notice: _notice('Plan link copied to share with HOD & co-teachers')));
  }

  Future<void> _onSave(LessonPlanSaved e, Emitter<LessonPlansState> emit) async {
    final p = e.plan;
    if (p.id.isEmpty) {
      final all = state.plans.isEmpty ? await _repo.getAll() : state.plans;
      final code = 'LP-${p.subject.isEmpty ? 'X' : p.subject[0]}${p.cls.split('-').first}-${(all.length + 1).toString().padLeft(2, '0')}';
      await _repo.create(p.copyWith(code: code));
    } else {
      await _repo.update(p);
    }
    emit(state.copyWith(notice: _notice(p.draft ? 'Saved as draft' : 'Lesson plan published', NoticeAction.pop)));
  }

  /// Milestones for a newly created plan: one per concept.
  static List<Milestone> milestonesFor(List<String> concepts) => [for (final c in concepts) Milestone(title: c)];

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
