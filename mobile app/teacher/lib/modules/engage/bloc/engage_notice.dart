import 'package:equatable/equatable.dart';

/// Load status shared by every engage BLoC state.
enum EngageStatus { initial, loading, loaded, failure }

/// One-shot feedback emitted by an engage BLoC after an action: a snackbar [message] and, when [pop] is set,
/// a request to close the screen (e.g. after a form is saved). [seq] makes every notice distinct.
class Notice extends Equatable {
  const Notice(this.message, {this.seq = 0, this.pop = false, this.error = false});
  final String message;
  final int seq;
  final bool pop, error;

  /// The next notice after [previous].
  factory Notice.next(Notice? previous, String message, {bool pop = false, bool error = false}) =>
      Notice(message, seq: (previous?.seq ?? 0) + 1, pop: pop, error: error);

  @override
  List<Object?> get props => [message, seq, pop, error];
}

/// Implemented by engage states so screens can react to notices with `NoticeListener`.
abstract interface class NoticeState {
  Notice? get notice;
}
