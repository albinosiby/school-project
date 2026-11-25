import 'package:equatable/equatable.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../home/models/timetable_models.dart';
import '../models/lesson_plan_models.dart';
import 'lessons_notice.dart';

enum LessonPlansStatus { initial, loading, loaded, failure }

class LessonPlansState extends Equatable {
  const LessonPlansState({
    this.status = LessonPlansStatus.initial,
    this.plans = const [],
    this.periods = const [],
    this.uploading = false,
    this.notice,
    this.error,
  });
  final LessonPlansStatus status;
  final List<LessonPlan> plans;

  /// The teacher's weekly timetable (session dates are suggested from it).
  final List<Period> periods;
  final bool uploading;
  final Notice? notice;
  final String? error;

  LessonPlan? byId(String id) => plans.where((p) => p.id == id).firstOrNull;
  int get activeCount => plans.where((p) => p.isActive).length;
  int get draftCount => plans.where((p) => p.draft).length;

  /// Today's sessions across plans, in period order.
  List<({LessonPlan plan, LessonSession session})> get today {
    final day = todayIso();
    final out = [
      for (final p in plans)
        if (!p.draft)
          for (final s in p.sessionsOn(day)) (plan: p, session: s),
    ];
    int order(String slot) => int.tryParse(slot.replaceAll(RegExp(r'\D'), '')) ?? 99;
    return out..sort((a, b) => order(a.session.slot).compareTo(order(b.session.slot)));
  }

  /// (weekday, slot) of the teacher's periods for [cls] and [subject].
  List<({int day, String slot})> slotsFor(String cls, String subject) => [
    for (final p in periods)
      if (p.label == cls && p.subject.toLowerCase() == subject.toLowerCase()) (day: p.day, slot: p.slot),
  ];

  LessonPlansState copyWith({
    LessonPlansStatus? status,
    List<LessonPlan>? plans,
    List<Period>? periods,
    bool? uploading,
    Notice? notice,
    String? error,
  }) => LessonPlansState(
    status: status ?? this.status,
    plans: plans ?? this.plans,
    periods: periods ?? this.periods,
    uploading: uploading ?? this.uploading,
    notice: notice ?? this.notice,
    error: error,
  );

  @override
  List<Object?> get props => [status, plans, periods, uploading, notice, error];
}
