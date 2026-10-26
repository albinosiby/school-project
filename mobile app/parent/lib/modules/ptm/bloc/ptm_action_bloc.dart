import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../repositories/ptm_repository_interface.dart';
import 'ptm_events.dart';
import 'ptm_states.dart';

/// Book / reschedule / cancel / join a parent-teacher meeting. Validation lives here, not in the widgets.
class PtmActionBloc extends Bloc<PtmActionEvent, PtmActionState> {
  PtmActionBloc(this._repo) : super(const PtmActionState()) {
    on<BookPtm>(_book);
    on<ReschedulePtm>(_reschedule);
    on<CancelPtm>(_cancel);
    on<JoinPtm>(_join);
    on<ResetPtmAction>((_, emit) => emit(const PtmActionState()));
  }

  final IPtmRepository _repo;

  static const minAgenda = 10;

  Future<void> _book(BookPtm e, Emitter<PtmActionState> emit) async {
    final errors = <String, String>{
      if (e.teacherId == null) 'teacher': 'Choose a teacher.',
      if (e.slotId == null) 'slot': 'Choose a time slot.',
      if (e.agenda.trim().length < minAgenda)
        'agenda':
            'Describe what you want to discuss (at least $minAgenda characters).',
    };
    if (errors.isNotEmpty)
      return emit(
        PtmActionState(
          status: PtmActionStatus.failure,
          action: PtmAction.book,
          errors: errors,
        ),
      );
    emit(
      const PtmActionState(
        status: PtmActionStatus.submitting,
        action: PtmAction.book,
      ),
    );
    try {
      final m = await _repo.book(
        childId: e.childId,
        teacherId: e.teacherId!,
        slotId: e.slotId!,
        mode: e.mode,
        agenda: e.agenda,
      );
      emit(
        PtmActionState(
          status: PtmActionStatus.success,
          action: PtmAction.book,
          meeting: m,
        ),
      );
    } catch (err) {
      emit(
        PtmActionState(
          status: PtmActionStatus.failure,
          action: PtmAction.book,
          error: errorMessage(err),
        ),
      );
    }
  }

  Future<void> _reschedule(
    ReschedulePtm e,
    Emitter<PtmActionState> emit,
  ) async {
    if (e.slotId == null)
      return emit(
        const PtmActionState(
          status: PtmActionStatus.failure,
          action: PtmAction.reschedule,
          errors: {'slot': 'Choose a new time slot.'},
        ),
      );
    emit(
      const PtmActionState(
        status: PtmActionStatus.submitting,
        action: PtmAction.reschedule,
      ),
    );
    try {
      final m = await _repo.reschedule(
        childId: e.childId,
        meetingId: e.meetingId,
        slotId: e.slotId!,
      );
      emit(
        PtmActionState(
          status: PtmActionStatus.success,
          action: PtmAction.reschedule,
          meeting: m,
        ),
      );
    } catch (err) {
      emit(
        PtmActionState(
          status: PtmActionStatus.failure,
          action: PtmAction.reschedule,
          error: errorMessage(err),
        ),
      );
    }
  }

  Future<void> _cancel(CancelPtm e, Emitter<PtmActionState> emit) async {
    emit(
      const PtmActionState(
        status: PtmActionStatus.submitting,
        action: PtmAction.cancel,
      ),
    );
    try {
      await _repo.cancel(childId: e.childId, meetingId: e.meetingId);
      emit(
        const PtmActionState(
          status: PtmActionStatus.success,
          action: PtmAction.cancel,
        ),
      );
    } catch (err) {
      emit(
        PtmActionState(
          status: PtmActionStatus.failure,
          action: PtmAction.cancel,
          error: errorMessage(err),
        ),
      );
    }
  }

  Future<void> _join(JoinPtm e, Emitter<PtmActionState> emit) async {
    try {
      await _repo.recordJoin(childId: e.childId, meetingId: e.meetingId);
    } catch (_) {
      // Recording the click must never block joining.
    }
  }
}
