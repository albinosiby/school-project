import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/data_bloc.dart';
import '../models/leave_models.dart';
import '../repositories/leave_repository_interface.dart';

class LeavesBloc extends DataBloc<List<CrewLeave>> {
  LeavesBloc(ILeaveRepository repo) : super((_) => repo.watch());
}

class LeaveFormState extends Equatable {
  const LeaveFormState({this.busy = false, this.error, this.saved});
  final bool busy;
  final String? error;
  final CrewLeave? saved;
  @override
  List<Object?> get props => [busy, error, saved];
}

sealed class LeaveFormEvent extends Equatable {
  const LeaveFormEvent();
  @override
  List<Object?> get props => [];
}

class SubmitLeave extends LeaveFormEvent {
  const SubmitLeave({required this.type, required this.from, required this.to, required this.reason});
  final String type, from, to, reason;
  @override
  List<Object?> get props => [type, from, to, reason];
}

class WithdrawLeave extends LeaveFormEvent {
  const WithdrawLeave(this.id);
  final String id;
  @override
  List<Object?> get props => [id];
}

class LeaveFormBloc extends Bloc<LeaveFormEvent, LeaveFormState> {
  LeaveFormBloc(this._repo) : super(const LeaveFormState()) {
    on<SubmitLeave>((e, emit) async {
      if (e.reason.trim().length < 3) {
        emit(const LeaveFormState(error: 'Give a short reason for the leave.'));
        return;
      }
      emit(const LeaveFormState(busy: true));
      try {
        emit(LeaveFormState(saved: await _repo.apply(type: e.type, from: e.from, to: e.to, reason: e.reason.trim())));
      } catch (err) {
        emit(LeaveFormState(error: errorMessage(err)));
      }
    }, transformer: droppable());
    on<WithdrawLeave>((e, emit) async {
      emit(const LeaveFormState(busy: true));
      try {
        await _repo.withdraw(e.id);
        emit(const LeaveFormState());
      } catch (err) {
        emit(LeaveFormState(error: errorMessage(err)));
      }
    }, transformer: droppable());
  }
  final ILeaveRepository _repo;
}
