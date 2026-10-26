import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../../../utils/helpers/date_helper.dart';
import '../repositories/leave_repository_interface.dart';

class LeaveApplyEvent extends Equatable {
  const LeaveApplyEvent({
    required this.childId,
    required this.from,
    required this.to,
    required this.reason,
  });
  final String childId, reason;
  final DateTime from, to;
  @override
  List<Object?> get props => [childId, from, to, reason];
}

enum ApplyStatus { idle, submitting, success, failure }

class LeaveApplyState extends Equatable {
  const LeaveApplyState({this.status = ApplyStatus.idle, this.error});
  final ApplyStatus status;
  final String? error;
  @override
  List<Object?> get props => [status, error];
}

/// Submits a leave application (validation lives here, not in the widget).
class LeaveApplyBloc extends Bloc<LeaveApplyEvent, LeaveApplyState> {
  LeaveApplyBloc(this._repo) : super(const LeaveApplyState()) {
    on<LeaveApplyEvent>((event, emit) async {
      if (event.reason.trim().isEmpty)
        return emit(
          const LeaveApplyState(
            status: ApplyStatus.failure,
            error: 'Please give a reason.',
          ),
        );
      if (dateOnly(event.to).isBefore(dateOnly(event.from)))
        return emit(
          const LeaveApplyState(
            status: ApplyStatus.failure,
            error: 'The end date cannot be before the start date.',
          ),
        );
      emit(const LeaveApplyState(status: ApplyStatus.submitting));
      try {
        await _repo.apply(
          childId: event.childId,
          from: event.from,
          to: event.to,
          reason: event.reason,
        );
        emit(const LeaveApplyState(status: ApplyStatus.success));
      } catch (e) {
        emit(
          LeaveApplyState(status: ApplyStatus.failure, error: errorMessage(e)),
        );
      }
    });
  }

  final ILeaveRepository _repo;
}
