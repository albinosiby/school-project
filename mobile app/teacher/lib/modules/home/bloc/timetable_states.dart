import 'package:school_sync/school_sync.dart';
import 'package:equatable/equatable.dart';
import '../../attendance/models/attendance_models.dart';
import '../models/timetable_models.dart';

enum TimetableStatus { initial, loading, loaded, failure }

class TimetableState extends Equatable {
  const TimetableState({
    this.policyVersion = '',
    this.status = TimetableStatus.initial,
    this.periods = const [],
    this.subs = const [],
    this.syncing = false,
    this.syncCount = 0,
    this.error,
    this.attendance = const {},
    this.attDrafts = const {},
  });
  final String policyVersion;
  final TimetableStatus status;
  final List<Period> periods;
  final List<Substitution> subs;
  final bool syncing;
  final int syncCount;
  final String? error;

  /// Submitted attendance, keyed by [attKey] (latest record per day, class and period).
  final Map<String, AttCounts> attendance;

  /// [attKey]s of periods that only have a saved draft.
  final Set<String> attDrafts;

  static String attKey(String date, String classId, int period) => '$date|$classId|$period';

  List<Period> periodsOf(int day) => periodsFor(periods, subs, day);
  List<Period> get week => [for (final d in schoolWorkingDays) ...periodsOf(d)];

  /// The first non-declined substitution of [day] (shown as the notice card).
  Substitution? noticeFor(int day) => subs.where((s) => s.day == day && s.status != SubStatus.declined).firstOrNull;

  TimetableState copyWith({
    TimetableStatus? status,
    List<Period>? periods,
    List<Substitution>? subs,
    bool? syncing,
    int? syncCount,
    String? error,
    Map<String, AttCounts>? attendance,
    Set<String>? attDrafts,
  }) => TimetableState(
    policyVersion: SchoolPolicyRuntime.current.version,
    status: status ?? this.status,
    periods: periods ?? this.periods,
    subs: subs ?? this.subs,
    syncing: syncing ?? this.syncing,
    syncCount: syncCount ?? this.syncCount,
    error: error,
    attendance: attendance ?? this.attendance,
    attDrafts: attDrafts ?? this.attDrafts,
  );

  @override
  List<Object?> get props => [policyVersion, status, periods, subs, syncing, syncCount, error, attendance, attDrafts];
}
