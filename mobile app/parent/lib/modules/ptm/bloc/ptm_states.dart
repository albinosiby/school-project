import 'package:equatable/equatable.dart';
import '../../../core/bloc/child_data_bloc.dart';
import '../models/ptm_models.dart';

typedef PtmState = DataState<PtmData>;

enum PtmAction { book, reschedule, cancel, join }

enum PtmActionStatus { idle, submitting, success, failure }

class PtmActionState extends Equatable {
  const PtmActionState({
    this.status = PtmActionStatus.idle,
    this.action,
    this.errors = const {},
    this.error,
    this.meeting,
  });
  final PtmActionStatus status;
  final PtmAction? action;

  /// Inline field errors: `teacher`, `slot`, `agenda`.
  final Map<String, String> errors;

  /// General failure (e.g. the slot was just taken).
  final String? error;

  /// Booked / moved meeting.
  final Meeting? meeting;

  bool get submitting => status == PtmActionStatus.submitting;

  @override
  List<Object?> get props => [status, action, errors, error, meeting];
}
