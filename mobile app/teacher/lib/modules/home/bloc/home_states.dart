import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';
import '../models/home_models.dart';
import '../../attendance/models/attendance_models.dart';
import '../models/timetable_models.dart';
import '../../attendance/models/circular_models.dart';
import '../../lessons/models/lesson_plan_models.dart';

enum HomeStatus { initial, loading, loaded, failure }

class HomeState extends Equatable {
  const HomeState({
    this.policyVersion = '',
    this.status = HomeStatus.initial,
    this.pending = const [],
    this.reminders = const [],
    this.periods = const [],
    this.subs = const [],
    this.error,
    this.today = const {},
    this.drafts = const {},
    this.periodsMarked = const {},
    this.latestCircular,
    this.lessonPlans = const [],
  });
  final String policyVersion;
  final HomeStatus status;
  final List<PendingTask> pending;
  final List<Reminder> reminders;
  final List<Period> periods;
  final List<Substitution> subs;
  final String? error;

  /// Today's attendance per class (the latest submitted record), for the class cards.
  final Map<String, AttCounts> today;

  /// Classes with a saved but unsubmitted attendance draft today (and no submitted record).
  final Set<String> drafts;

  /// Today's submitted registers by [periodKey] (class + period).
  final Map<String, AttCounts> periodsMarked;
  static String periodKey(String classId, int period) => '$classId|$period';
  AttCounts? markedFor(String? classId, String periodNo) =>
      classId == null ? null : periodsMarked[periodKey(classId, int.tryParse(periodNo) ?? 0)];

  /// The most recently published circular, for the home card.
  final Circular? latestCircular;

  /// Published lesson plans, for today's lessons.
  final List<LessonPlan> lessonPlans;

  List<PendingTask> get open => pending.where((p) => !p.done).toList();
  List<Period> periodsOf(int day) => periodsFor(periods, subs, day);

  HomeState copyWith({
    HomeStatus? status,
    List<PendingTask>? pending,
    List<Reminder>? reminders,
    List<Period>? periods,
    List<Substitution>? subs,
    String? error,
    Map<String, AttCounts>? today,
    Set<String>? drafts,
    Map<String, AttCounts>? periodsMarked,
    Circular? latestCircular,
    List<LessonPlan>? lessonPlans,
  }) => HomeState(
    policyVersion: SchoolPolicyRuntime.current.version,
    status: status ?? this.status,
    pending: pending ?? this.pending,
    reminders: reminders ?? this.reminders,
    periods: periods ?? this.periods,
    subs: subs ?? this.subs,
    error: error,
    today: today ?? this.today,
    drafts: drafts ?? this.drafts,
    periodsMarked: periodsMarked ?? this.periodsMarked,
    latestCircular: latestCircular ?? this.latestCircular,
    lessonPlans: lessonPlans ?? this.lessonPlans,
  );

  @override
  List<Object?> get props => [policyVersion, status, pending, reminders, periods, subs, error, today, drafts, periodsMarked, latestCircular, lessonPlans];
}
