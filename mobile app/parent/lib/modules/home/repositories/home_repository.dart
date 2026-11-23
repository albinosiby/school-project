import 'package:school_sync/school_sync.dart';
import '../../attendance/models/attendance_models.dart';
import '../../timetable/models/timetable_models.dart';
import '../../homework/models/homework_models.dart';
import '../../notices/models/notice_models.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/cache_service.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../homework/repositories/homework_repository_interface.dart';
import '../../live_classes/models/live_class_models.dart';
import '../../live_classes/repositories/live_class_repository_interface.dart';
import '../../notices/repositories/notice_repository_interface.dart';
import '../../timetable/repositories/timetable_repository_interface.dart';
import '../../transport/models/transport_models.dart';
import '../../transport/repositories/transport_repository_interface.dart';
import '../models/home_models.dart';
import 'home_repository_interface.dart';

/// Backend-agnostic: composes the other repository interfaces (incl. transport) into the Home summary
/// (each source is itself cache-first, so `.first` returns instantly when cached).
class HomeRepository implements IHomeRepository {
  HomeRepository({
    required CacheService cache,
    required ITimetableRepository timetable,
    required IAttendanceRepository attendance,
    required IHomeworkRepository homework,
    required INoticeRepository notices,
    required ILiveClassRepository liveClasses,
    required ITransportRepository transport,
    DateTime Function()? clock,
  }) : _cache = cache, // ignore: prefer_initializing_formals
       _timetable = timetable, // ignore: prefer_initializing_formals
       _attendance = attendance, // ignore: prefer_initializing_formals
       _homework = homework, // ignore: prefer_initializing_formals
       _notices = notices, // ignore: prefer_initializing_formals
       _live = liveClasses,
       _transport = transport, // ignore: prefer_initializing_formals
       _clock = clock ?? DateTime.now;

  final CacheService _cache;
  final ITimetableRepository _timetable;
  final IAttendanceRepository _attendance;
  final IHomeworkRepository _homework;
  final INoticeRepository _notices;
  final ILiveClassRepository _live;
  final ITransportRepository _transport;
  final DateTime Function() _clock;

  @override
  Stream<HomeSummary> watchToday(String childId) async* {
    final key = 'home:$childId';
    final generation = _cache.generation;
    final cached = _cache.read<HomeSummary>(key);
    if (cached != null) yield cached;
    yield* combineSchoolStreams<Object?>([
      _timetable.watchWeek(childId),
      _attendance.watchAttendance(childId),
      _homework.watchHomework(childId),
      _notices.watchNotices(childId),
      _live.watchLiveClasses(childId),
      _optionalBus(childId),
    ]).asyncMap((all) async {
      final summary = await _build(
        childId,
        all[0] as TimetableWeek,
        all[1] as AttendanceData,
        all[2] as List<Homework>,
        all[3] as List<Notice>,
        all[4] as List<LiveClass>,
        all[5] as BusTrip?,
      );
      if (_cache.generation == generation) _cache.write(key, summary);
      return summary;
    });
  }

  Stream<BusTrip?> _optionalBus(String childId) async* {
    var emitted = false;
    try {
      await for (final trip in _transport.watchTrip(childId)) {
        emitted = true;
        yield trip;
      }
    } catch (_) {
      /* Optional bus feed must not block academic data. */
    }
    if (!emitted) yield null;
  }

  Future<HomeSummary> _build(
    String childId,
    TimetableWeek week,
    AttendanceData attendance,
    List<Homework> homework,
    List<Notice> notices,
    List<LiveClass> live,
    BusTrip? bus,
  ) async {
    final clock = _clock();
    final now = week.utcOffsetMinutes == null ? clock : clock.toUtc().add(Duration(minutes: week.utcOffsetMinutes!));

    final todayRecord = attendance.on(now);
    final isSchoolDay = week.days.contains(now.weekday) && todayRecord?.status != AttendanceStatus.holiday;
    // Not yet handed in and due by tomorrow (overdue items included).
    final due = homework.where((h) => !h.submitted && !h.reviewed && !dateOnly(h.due).isAfter(plusDays(1, from: now))).toList()
      ..sort((a, b) => a.due.compareTo(b.due));
    final sortedNotices = [...notices]
      ..sort((a, b) {
        if (a.needsAction != b.needsAction) return a.needsAction ? -1 : 1;
        return b.date.compareTo(a.date);
      });
    final inReview = homework.where((h) => h.submitted && !h.reviewed).toList()..sort((a, b) => b.due.compareTo(a.due));
    final attended =
        todayRecord != null &&
        const {AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.halfDay}.contains(todayRecord.status);
    final gate = attended ? await _transport.gateEntryOn(childId, now).catchError((Object _) => null) : null;
    final upcoming = live.where((c) => c.statusAt(now) != LiveStatus.ended).toList()..sort((a, b) => a.start.compareTo(b.start));

    return HomeSummary(
      periods: isSchoolDay ? week.forDay(now.weekday) : const [],
      attendanceToday: todayRecord,
      isSchoolDay: isSchoolDay,
      homeworkDue: due,
      homeworkInReview: inReview,
      termAttendance: attendance.overall.percentage,
      minimumAttendance: attendance.minimumAttendance,
      gateEntry: gate,
      // no card for a child who is not on a school bus
      bus: isSchoolDay && (bus?.onBus ?? false) ? bus : null,
      notices: sortedNotices.take(3).toList(),
      nextLiveClass: upcoming.isEmpty ? null : upcoming.first,
    );
  }
}
