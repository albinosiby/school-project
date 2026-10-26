import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../models/online_test_models.dart';
import '../repositories/online_test_repository_interface.dart';
import 'lessons_notice.dart';
import 'online_tests_events.dart';
import 'online_tests_states.dart';

/// Online tests list and editor. Reloads when `ts_tests` changes.
class OnlineTestsBloc extends Bloc<OnlineTestsEvent, OnlineTestsState> {
  OnlineTestsBloc(this._repo) : super(const OnlineTestsState()) {
    on<OnlineTestsLoadRequested>(_onLoad);
    on<OnlineTestAction>(_onAction);
    on<OnlineTestSaved>(_onSave);
    _sub = _repo.watch().listen((_) => add(const OnlineTestsLoadRequested()));
  }

  final IOnlineTestRepository _repo;
  late final StreamSubscription<void> _sub;
  int _n = 0;

  Notice _notice(String m, [NoticeAction a = NoticeAction.none]) => Notice(++_n, m, action: a);

  Future<void> _onLoad(OnlineTestsLoadRequested e, Emitter<OnlineTestsState> emit) async {
    if (state.status == OnlineTestsStatus.initial) emit(state.copyWith(status: OnlineTestsStatus.loading));
    try {
      emit(state.copyWith(status: OnlineTestsStatus.loaded, tests: await _repo.getAll()));
    } on AppException catch (err) {
      emit(state.copyWith(status: OnlineTestsStatus.failure, error: err.message));
    }
  }

  Future<void> _onAction(OnlineTestAction e, Emitter<OnlineTestsState> emit) async {
    final t = state.byId(e.id) ?? await _repo.get(e.id);
    if (t == null) return;
    final String msg;
    switch (e) {
      case OnlineTestStarted():
        await _repo.update(t.copyWith(status: 'live'));
        msg = 'Test is now live';
      case OnlineTestEnded():
        await _repo.update(t.copyWith(status: 'completed', results: TestResults(submitted: t.students - 2, avg: 68, high: 46, low: 15)));
        msg = 'Test ended. Results summary ready';
      case OnlineTestReused():
        final count = (await _repo.getAll()).length;
        await _repo.create(t.copyWith(id: '', status: 'draft', title: '${t.title} (Copy)', clearResults: true, code: 'TEST-${t.cls.replaceAll('-', '')}-${count + 1}'));
        msg = 'Copied as a draft';
      case OnlineTestShared():
        await _repo.share(t.id);
        msg = 'Test link copied';
      case OnlineTestDeleted():
        await _repo.delete(t.id);
        msg = 'Test deleted';
    }
    emit(state.copyWith(notice: _notice(msg)));
  }

  Future<void> _onSave(OnlineTestSaved e, Emitter<OnlineTestsState> emit) async {
    final isNew = e.test.id.isEmpty;
    final existing = isNew ? null : (state.byId(e.test.id) ?? await _repo.get(e.test.id));
    final status = !e.publish ? 'draft' : (existing?.status == 'live' || existing?.status == 'completed' ? existing!.status : 'upcoming');
    final t = e.test.copyWith(status: status, nq: e.test.questions.length);
    if (isNew) {
      final count = (await _repo.getAll()).length;
      final subj = (t.subject.length > 4 ? t.subject.substring(0, 4) : t.subject).toUpperCase();
      await _repo.create(t.copyWith(code: 'TEST-$subj${t.cls.replaceAll('-', '')}-${(count + 1).toString().padLeft(2, '0')}'));
    } else {
      await _repo.update(t.copyWith(code: existing?.code, students: existing?.students, results: existing?.results));
    }
    if (t.notify && e.publish) await _repo.notify('Test "${t.title}" scheduled for Class ${t.cls}');
    emit(state.copyWith(notice: _notice(e.publish ? (isNew ? 'Test published' : 'Changes saved') : 'Draft saved', NoticeAction.pop)));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
