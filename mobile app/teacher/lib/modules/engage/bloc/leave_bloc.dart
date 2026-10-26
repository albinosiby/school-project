import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../school/repositories/school_repository_interface.dart';
import '../repositories/leave_repository_interface.dart';
import 'engage_notice.dart';
import 'leave_events.dart';
import 'leave_states.dart';

/// My leaves (balances, upcoming, history) and the student leave requests to review.
class LeaveBloc extends Bloc<LeaveEvent, LeaveState> {
  LeaveBloc(this._repo, this._school) : super(const LeaveState()) {
    on<LeaveLoadRequested>(_onLoad);
    on<MyLeaveCancelled>(_onCancelled);
    on<StudentLeaveDecided>(_onDecided);
    _sub = _repo.watch().listen((_) => add(const LeaveLoadRequested()));
  }

  final ILeaveRepository _repo;
  final ISchoolRepository _school;
  late final StreamSubscription<void> _sub;

  Future<void> _onLoad(LeaveLoadRequested e, Emitter<LeaveState> emit) async {
    if (state.status == EngageStatus.initial) emit(state.copyWith(status: EngageStatus.loading));
    try {
      emit(state.copyWith(
        status: EngageStatus.loaded,
        myLeaves: await _repo.getMyLeaves(),
        balances: await _repo.getBalances(),
        studentLeaves: await _repo.getStudentLeaves(),
      ));
    } on AppException catch (err) {
      emit(state.copyWith(status: EngageStatus.failure, error: err.message));
    }
  }

  Future<void> _onCancelled(MyLeaveCancelled e, Emitter<LeaveState> emit) async {
    await _repo.cancelMyLeave(e.id);
    emit(state.copyWith(notice: Notice.next(state.notice, 'Leave cancelled')));
  }

  Future<void> _onDecided(StudentLeaveDecided e, Emitter<LeaveState> emit) async {
    final me = await _school.getTeacher();
    final name = state.studentLeaves.where((l) => l.id == e.id).firstOrNull?.name ?? 'student';
    await _repo.decideStudentLeave(e.id, approve: e.approve, processedBy: 'by ${me.name}', note: e.note);
    emit(state.copyWith(notice: Notice.next(state.notice, e.approve ? 'Leave approved for $name' : 'Leave denied for $name')));
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
