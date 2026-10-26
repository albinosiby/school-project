import 'package:equatable/equatable.dart';
import '../models/timetable_models.dart';

enum TimetableStatus { initial, loading, loaded, failure }

class TimetableState extends Equatable {
  const TimetableState({this.status = TimetableStatus.initial, this.periods = const [], this.subs = const [], this.syncing = false, this.syncCount = 0, this.error});
  final TimetableStatus status;
  final List<Period> periods;
  final List<Substitution> subs;
  final bool syncing;
  final int syncCount;
  final String? error;

  List<Period> periodsOf(int day) => periodsFor(periods, subs, day);
  List<Period> get week => [for (var d = 1; d <= 6; d++) ...periodsOf(d)];
  /// The first non-declined substitution of [day] (shown as the notice card).
  Substitution? noticeFor(int day) => subs.where((s) => s.day == day && s.status != SubStatus.declined).firstOrNull;

  TimetableState copyWith({TimetableStatus? status, List<Period>? periods, List<Substitution>? subs, bool? syncing, int? syncCount, String? error}) => TimetableState(
        status: status ?? this.status, periods: periods ?? this.periods, subs: subs ?? this.subs, syncing: syncing ?? this.syncing,
        syncCount: syncCount ?? this.syncCount, error: error,
      );

  @override
  List<Object?> get props => [status, periods, subs, syncing, syncCount, error];
}
