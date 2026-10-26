import 'package:equatable/equatable.dart';
import '../models/home_models.dart';
import '../../attendance/models/attendance_models.dart';
import '../models/timetable_models.dart';

enum HomeStatus { initial, loading, loaded, failure }

class HomeState extends Equatable {
  const HomeState({this.status = HomeStatus.initial, this.pending = const [], this.reminders = const [], this.periods = const [], this.subs = const [], this.error, this.today = const {}});
  final HomeStatus status;
  final List<PendingTask> pending;
  final List<Reminder> reminders;
  final List<Period> periods;
  final List<Substitution> subs;
  final String? error;
  /// Today's attendance per class (the latest submitted record), for the class cards.
  final Map<String, AttCounts> today;

  List<PendingTask> get open => pending.where((p) => !p.done).toList();
  List<Period> periodsOf(int day) => periodsFor(periods, subs, day);

  HomeState copyWith({HomeStatus? status, List<PendingTask>? pending, List<Reminder>? reminders, List<Period>? periods, List<Substitution>? subs, String? error, Map<String, AttCounts>? today}) => HomeState(
        status: status ?? this.status, pending: pending ?? this.pending, reminders: reminders ?? this.reminders, periods: periods ?? this.periods,
        subs: subs ?? this.subs, error: error,
        today: today ?? this.today,
      );

  @override
  List<Object?> get props => [status, pending, reminders, periods, subs, error, today];
}
