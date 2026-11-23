import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:school_sync/school_sync.dart';
import '../../../utils/services/firebase/parent_session.dart';
import '../models/timetable_models.dart';
import 'timetable_repository_interface.dart';

class FirebaseTimetableRepository implements ITimetableRepository {
  FirebaseTimetableRepository(this._session);
  final ParentSession _session;
  static const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  Stream<TimetableWeek> watchWeek(
    String childId,
  ) => switchSchoolStream(combineLatest<Object>([_session.col('students').doc(childId).snapshots(), _session.watchUser()]), (values) {
    final child = values[0] as DocumentSnapshot<Json>;
    final classId = '${child.data()?['classId'] ?? ''}';
    if (classId.isEmpty) return Stream.value(const TimetableWeek([]));
    return combineLatest<Object>([
      _session.col('ops_periods').where('classId', isEqualTo: classId).snapshots(),
      _session.col('classes').doc(classId).snapshots(),
      _session.watchPolicy(),
    ]).asyncMap((all) async {
      final policy = all[2] as SchoolPolicy;
      final now = policy.schoolTime();
      final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
      final updates = await _session.mobile.call('getMobileStudentTimetable', {'studentId': childId, 'weekStart': isoDay(monday)});
      final substitutions = [
        for (final row in updates['substitutions'] as List? ?? const [])
          if (row is Map) row,
      ];
      final room = '${(all[1] as DocumentSnapshot<Json>).data()?['room'] ?? ''}';
      final saved = (all[0] as QuerySnapshot<Json>).docs;
      final periods = <Period>[];
      for (final day in policy.workingDays) {
        for (final slot in policy.slots) {
          final number = int.tryParse(slot.id.replaceFirst('P', ''));
          final matches = saved.where(
            (doc) => '${doc.data()['day']}' == days[day - 1] && int.tryParse('${doc.data()['period']}') == number,
          );
          final data = matches.firstOrNull?.data();
          final substitution = slot.isBreak || slot.isGap
              ? null
              : substitutions
                    .where(
                      (row) =>
                          '${row['date']}' == isoDay(monday.add(Duration(days: day - 1))) && int.tryParse('${row['period']}') == number,
                    )
                    .firstOrNull;
          periods.add(
            Period(
              weekday: day,
              startMinute: slot.startMinute,
              endMinute: slot.endMinute,
              subject: slot.isBreak || slot.isGap
                  ? slot.label
                  : '${substitution?['subject'] != null && substitution!['subject'] != '' ? substitution['subject'] : data?['subject'] ?? 'Unassigned'}',
              teacher: substitution == null ? '${data?['teacher'] ?? ''}' : '${substitution['teacher']} · Substitute',
              room: '${substitution?['room'] ?? data?['room'] ?? ''}'.isEmpty ? room : '${substitution?['room'] ?? data?['room']}',
              isBreak: slot.isBreak || slot.isGap,
              number: number,
            ),
          );
        }
      }
      return TimetableWeek(periods, utcOffsetMinutes: policy.utcOffsetMinutes);
    });
  });
}
