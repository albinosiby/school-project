import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/exam_duty_repository_interface.dart';
import 'engage_notice.dart';
import 'exam_duties_events.dart';
import 'exam_duties_states.dart';

/// Exam duty list, protocol checklist, swap requests and duty details.
class ExamDutiesBloc extends Bloc<ExamDutiesEvent, ExamDutiesState> {
  ExamDutiesBloc(this._repo) : super(const ExamDutiesState()) {
    on<ExamDutiesLoadRequested>(_onLoad);
    on<ChecklistItemToggled>(_onChecklist);
    on<SwapRequested>(_onSwap);
    on<SwapCancelled>(_onSwapCancelled);
    _sub = _repo.watch().listen((_) => add(const ExamDutiesLoadRequested()));
  }

  final IExamDutyRepository _repo;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(ExamDutiesLoadRequested e, Emitter<ExamDutiesState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(status: EngageStatus.loaded, duties: await _repo.getAll()));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onChecklist(ChecklistItemToggled e, Emitter<ExamDutiesState> emit) async {
    final d = state.byId(e.id) ?? await _repo.get(e.id);
    if (d == null) return;
    final set = {...d.checked};
    e.checked ? set.add(e.index) : set.remove(e.index);
    await _repo.setChecklist(e.id, set.toList()..sort());
  }

  Future<void> _onSwap(SwapRequested e, Emitter<ExamDutiesState> emit) async {
    await _repo.requestSwap(e.id, withWhom: e.withWhom, reason: e.reason);
    emit(state.copyWith(notice: Notice.next(state.notice, 'Swap request sent to ${e.withWhom}')));
  }

  Future<void> _onSwapCancelled(SwapCancelled e, Emitter<ExamDutiesState> emit) async {
    await _repo.cancelSwap(e.id);
    emit(state.copyWith(notice: Notice.next(state.notice, 'Swap request withdrawn')));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
