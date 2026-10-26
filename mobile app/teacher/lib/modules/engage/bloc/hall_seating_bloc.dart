import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../repositories/exam_duty_repository_interface.dart';
import 'engage_notice.dart';
import 'hall_seating_events.dart';
import 'hall_seating_states.dart';

/// Hall seating plan of one duty: candidate attendance, supplementary sheets, incident notes and final submission.
class HallSeatingBloc extends Bloc<HallSeatingEvent, HallSeatingState> {
  HallSeatingBloc(this._repo) : super(const HallSeatingState()) {
    on<HallSeatingLoadRequested>(_onLoad);
    on<CandidateMarked>(_onMarked);
    on<SupplementaryChanged>(_onSupp);
    on<IncidentNoteSaved>(_onNote);
    on<FinalListSubmitted>(_onSubmit);
    _sub = _repo.watch().listen((_) {
      if (state.dutyId.isNotEmpty) add(HallSeatingLoadRequested(state.dutyId));
    });
  }

  final IExamDutyRepository _repo;
  late final StreamSubscription<void> _sub;

  Notice _next(String m) => Notice.next(state.notice, m);

  Future<void> _onLoad(HallSeatingLoadRequested e, Emitter<HallSeatingState> emit) async {
    if (state.dutyId != e.dutyId) emit(state.copyWith(status: EngageStatus.loading, dutyId: e.dutyId));
    try {
      emit(HallSeatingState(
        status: EngageStatus.loaded, dutyId: e.dutyId, duty: await _repo.get(e.dutyId), candidates: await _repo.getCandidates(e.dutyId), notice: state.notice,
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onMarked(CandidateMarked e, Emitter<HallSeatingState> emit) async {
    final c = state.byId(e.candidateId) ?? await _repo.getCandidate(e.candidateId);
    await _repo.markCandidate(e.candidateId, present: e.present);
    emit(state.copyWith(notice: _next('${c?.name ?? 'Candidate'} marked ${e.present ? 'present' : 'absent'}')));
  }

  Future<void> _onSupp(SupplementaryChanged e, Emitter<HallSeatingState> emit) async {
    final c = state.byId(e.candidateId) ?? await _repo.getCandidate(e.candidateId);
    await _repo.setSupplementary(e.candidateId, e.count);
    if (c != null && e.count > c.supp) emit(state.copyWith(notice: _next('Supplementary sheet issued')));
  }

  Future<void> _onNote(IncidentNoteSaved e, Emitter<HallSeatingState> emit) async {
    final note = e.note.trim();
    await _repo.saveIncidentNote(e.candidateId, note);
    emit(state.copyWith(notice: _next(note.isEmpty ? 'Note cleared' : 'Incident note saved')));
  }

  Future<void> _onSubmit(FinalListSubmitted e, Emitter<HallSeatingState> emit) async {
    await _repo.submitFinalList(state.dutyId);
    emit(state.copyWith(notice: _next('Final attendance list submitted')));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
