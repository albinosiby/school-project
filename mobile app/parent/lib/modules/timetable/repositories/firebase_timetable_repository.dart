import '../../../utils/services/firebase/parent_session.dart';
import '../models/timetable_models.dart';
import 'timetable_repository_interface.dart';

/// The child's class week from `ops_periods` (`classId`, `day: "Mon"`, `period: 1..8`).
class FirebaseTimetableRepository implements ITimetableRepository {
  FirebaseTimetableRepository(this._session);
  final ParentSession _session;

  /// School bell times, same as the teacher app (P1 08:30 … P6 13:15, 45 minutes; recess 10:00, lunch 11:45).
  static const bells = <int, (int, int)>{
    1: (8 * 60 + 30, 9 * 60 + 15),
    2: (9 * 60 + 15, 10 * 60),
    3: (10 * 60 + 15, 11 * 60),
    4: (11 * 60, 11 * 60 + 45),
    5: (12 * 60 + 30, 13 * 60 + 15),
    6: (13 * 60 + 15, 14 * 60),
    7: (14 * 60, 14 * 60 + 45),
    8: (14 * 60 + 45, 15 * 60 + 30),
  };
  static const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Stream<TimetableWeek> watchWeek(String childId) async* {
    final classId = await _session.classIdOf(childId);
    if (classId.isEmpty) {
      yield const TimetableWeek([]);
      return;
    }
    yield* _session.col('ops_periods').where('classId', isEqualTo: classId).snapshots().map((q) {
      final periods = <Period>[];
      for (final doc in q.docs) {
        final d = doc.data();
        final day = days.indexOf('${d['day']}') + 1;
        final bell = bells[(d['period'] as num?)?.toInt() ?? int.tryParse('${d['period']}') ?? 0];
        if (day == 0 || bell == null) continue;
        periods.add(Period(
          weekday: day,
          startMinute: bell.$1,
          endMinute: bell.$2,
          subject: '${d['subject'] ?? ''}',
          teacher: '${d['teacher'] ?? ''}',
          room: '${d['room'] ?? ''}',
        ));
      }
      return TimetableWeek(periods);
    });
  }
}
