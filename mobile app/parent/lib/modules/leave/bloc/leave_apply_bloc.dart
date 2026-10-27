import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/bloc/child_data_bloc.dart' show errorMessage;
import '../../../utils/helpers/date_helper.dart';
import '../models/leave_models.dart';
import '../repositories/leave_repository_interface.dart';

class LeaveApplyEvent extends Equatable {
  const LeaveApplyEvent({
    required this.childId,
    required this.from,
    required this.to,
    required this.reason,
    this.type = LeaveType.other,
    this.attachment,
    this.daysLeft,
  });
  final String childId, reason;
  final DateTime from, to;
  final LeaveType type;
  final String? attachment;

  /// Remaining allowance of the type's pool; null skips the balance check.
  final int? daysLeft;

  @override
  List<Object?> get props => [
    childId,
    from,
    to,
    reason,
    type,
    attachment,
    daysLeft,
  ];
}

enum ApplyStatus { idle, submitting, success, failure }

/// Which form field an error belongs to (shown inline under it).
enum LeaveField { reason, dates, balance, submit }

class LeaveApplyState extends Equatable {
  const LeaveApplyState({
    this.status = ApplyStatus.idle,
    this.error,
    this.field,
  });
  final ApplyStatus status;
  final String? error;
  final LeaveField? field;

  String? errorFor(LeaveField f) =>
      status == ApplyStatus.failure && field == f ? error : null;

  @override
  List<Object?> get props => [status, error, field];
}

/// Submits a leave application (validation lives here, not in the widget).
class LeaveApplyBloc extends Bloc<LeaveApplyEvent, LeaveApplyState> {
  LeaveApplyBloc(this._repo) : super(const LeaveApplyState()) {
    on<LeaveApplyEvent>((event, emit) async {
      LeaveApplyState fail(LeaveField f, String m) =>
          LeaveApplyState(status: ApplyStatus.failure, error: m, field: f);
      if (event.reason.trim().isEmpty)
        return emit(fail(LeaveField.reason, 'Please give a reason.'));
      if (dateOnly(event.to).isBefore(dateOnly(event.from)))
        return emit(
          fail(
            LeaveField.dates,
            'The end date cannot be before the start date.',
          ),
        );
      final days = workingDaysBetween(event.from, event.to);
      if (days == 0)
        return emit(
          fail(
            LeaveField.dates,
            'Those dates fall on a weekend. Pick at least one school day.',
          ),
        );
      final left = event.daysLeft;
      if (left != null && days > left)
        return emit(
          fail(
            LeaveField.balance,
            'Only $left ${event.type.pool.label} leave day${left == 1 ? '' : 's'} left this year.',
          ),
        );
      emit(const LeaveApplyState(status: ApplyStatus.submitting));
      try {
        await _repo.apply(
          childId: event.childId,
          from: event.from,
          to: event.to,
          reason: event.reason,
          type: event.type,
          attachment: event.attachment,
        );
        emit(const LeaveApplyState(status: ApplyStatus.success));
      } catch (e) {
        emit(fail(LeaveField.submit, errorMessage(e)));
      }
    });
  }

  final ILeaveRepository _repo;
}
