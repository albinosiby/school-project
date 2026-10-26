import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/cache_service.dart';
import '../../attendance/models/attendance_models.dart';
import '../../attendance/repositories/attendance_repository_interface.dart';
import '../../homework/repositories/homework_repository_interface.dart';
import '../../live_classes/models/live_class_models.dart';
import '../../live_classes/repositories/live_class_repository_interface.dart';
import '../../notices/repositories/notice_repository_interface.dart';
import '../../timetable/repositories/timetable_repository_interface.dart';
import '../models/home_models.dart';
import 'home_repository_interface.dart';

/// Backend-agnostic: composes the other repository interfaces into the Today summary
/// (each source is itself cache-first, so `.first` returns instantly when cached).
class HomeRepository implements IHomeRepository {
  HomeRepository({
    required CacheService cache,
    required ITimetableRepository timetable,
    required IAttendanceRepository attendance,
    required IHomeworkRepository homework,
    required INoticeRepository notices,
    required ILiveClassRepository liveClasses,
    DateTime Function()? clock,
  }) : _cache = cache, // ignore: prefer_initializing_formals
       _timetable = timetable, // ignore: prefer_initializing_formals
       _attendance = attendance, // ignore: prefer_initializing_formals
       _homework = homework, // ignore: prefer_initializing_formals
       _notices = notices, // ignore: prefer_initializing_formals
       _live = liveClasses,
       _clock = clock ?? DateTime.now;

  final CacheService _cache;
  final ITimetableRepository _timetable;
  final IAttendanceRepository _attendance;
  final IHomeworkRepository _homework;
  final INoticeRepository _notices;
  final ILiveClassRepository _live;
  final DateTime Function() _clock;

  @override
  Stream<HomeSummary> watchToday(String childId) => cacheFirst(
    cache: _cache,
    key: 'home:$childId',
    fetch: () => _build(childId),
  );

  Future<HomeSummary> _build(String childId) async {
    final now = _clock();
    final week = await _timetable.watchWeek(childId).first;
    final attendance = await _attendance.watchAttendance(childId).first;
    final homework = await _homework.watchHomework(childId).first;
    final notices = await _notices.watchNotices(childId).first;
    final live = await _live.watchLiveClasses(childId).first;

    final todayRecord = attendance.on(now);
    final isSchoolDay =
        now.weekday <= DateTime.friday &&
        todayRecord?.status != AttendanceStatus.holiday;
    // Not yet handed in and due by tomorrow (overdue items included).
    final due =
        homework
            .where(
              (h) =>
                  !h.submitted &&
                  !h.reviewed &&
                  !dateOnly(h.due).isAfter(plusDays(1, from: now)),
            )
            .toList()
          ..sort((a, b) => a.due.compareTo(b.due));
    final sortedNotices = [...notices]
      ..sort((a, b) {
        if (a.needsAction != b.needsAction) return a.needsAction ? -1 : 1;
        return b.date.compareTo(a.date);
      });
    final upcoming =
        live.where((c) => c.statusAt(now) != LiveStatus.ended).toList()
          ..sort((a, b) => a.start.compareTo(b.start));

    return HomeSummary(
      periods: isSchoolDay ? week.forDay(now.weekday) : const [],
      attendanceToday: todayRecord,
      isSchoolDay: isSchoolDay,
      homeworkDue: due,
      notices: sortedNotices.take(3).toList(),
      nextLiveClass: upcoming.isEmpty ? null : upcoming.first,
    );
  }
}
