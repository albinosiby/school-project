import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../teachers/models/teacher_models.dart';
import '../models/ptm_models.dart';

/// Demo meetings and teacher slots, relative to "now" (one upcoming meeting tomorrow, past ones this year).
class PtmDemoData {
  PtmDemoData._();

  static const slotMinutes = 20;

  /// Afternoon PTM slots (minutes since midnight): 3:00 PM .. 4:20 PM.
  static const slotStarts = [900, 920, 940, 960, 980];

  static List<Meeting> meetings(String childId, {DateTime? now}) {
    final n = now ?? DateTime.now();
    final d = dateOnly(n);
    final aarav = childId == DemoData.aarav.id;
    if (aarav) {
      return [
        Meeting(
          id: 'ptm_${childId}_1',
          childId: childId,
          title: 'Term 2 Academic Review & Pre-Board Road Map',
          agenda: 'Class 10 board timelines, mock exams, and guidance',
          teacherId: 'tch_anita',
          teacherName: 'Mrs. Anita Sharma',
          teacherRole: 'Mathematics • Class Lead',
          start: d.add(const Duration(days: 1, hours: 10, minutes: 30)),
          mins: 30,
          mode: MeetingMode.virtual,
          location: 'Google Meet',
          link: 'https://meet.google.com/ptm-revw-10b',
        ),
        Meeting(
          id: 'ptm_${childId}_2',
          childId: childId,
          title: 'Term 1 Mid-Term Comprehensive Review',
          agenda: 'Mid-term results, study plan and Science practicals',
          teacherId: 'tch_anita',
          teacherName: 'Mrs. Anita Sharma & Mr. Joseph Mathew',
          teacherRole: 'Class Lead & Social Science',
          start: d
              .subtract(const Duration(days: 74))
              .add(const Duration(hours: 11)),
          mins: 30,
          mode: MeetingMode.inPerson,
          location: 'Room 204',
          status: MeetingStatus.attended,
          minutes:
              'Aarav scored well in Mathematics and Science. Agreed to two extra practice papers a week for '
              'Social Science before the half-yearly exams. Next review after Term 2 mock exams.',
        ),
        Meeting(
          id: 'ptm_${childId}_3',
          childId: childId,
          title: 'Class 10 Annual Orientation',
          agenda: 'Board exam pattern, syllabus and school calendar',
          teacherId: 'tch_anita',
          teacherName: 'Class 10 Core Faculty Panel',
          teacherRole: 'All subject teachers',
          start: d
              .subtract(const Duration(days: 170))
              .add(const Duration(hours: 10)),
          mins: 60,
          mode: MeetingMode.virtual,
          location: 'Google Meet',
          link: 'https://meet.google.com/ori-entn-10b',
          status: MeetingStatus.attended,
          minutes:
              'Board exam pattern, internal assessment weightage and the year calendar were presented. '
              'Parents were asked to review the syllabus booklet and the attendance policy (75% minimum).',
        ),
      ];
    }
    return [
      Meeting(
        id: 'ptm_${childId}_1',
        childId: childId,
        title: 'Term 1 Progress Discussion',
        agenda: 'Reading habits, Mathematics practice and class participation',
        teacherId: 'tch_vikram',
        teacherName: 'Mr. Vikram Nair',
        teacherRole: 'Library • Class Teacher',
        start: d.add(const Duration(days: 3, hours: 15)),
        mins: 20,
        mode: MeetingMode.inPerson,
        location: 'Library',
      ),
      Meeting(
        id: 'ptm_${childId}_2',
        childId: childId,
        title: 'Class 8 Annual Orientation',
        agenda: 'Curriculum overview and co-curricular activities',
        teacherId: 'tch_vikram',
        teacherName: 'Class 8 Core Faculty Panel',
        teacherRole: 'All subject teachers',
        start: d
            .subtract(const Duration(days: 165))
            .add(const Duration(hours: 10)),
        mins: 60,
        mode: MeetingMode.virtual,
        location: 'Google Meet',
        link: 'https://meet.google.com/ori-entn-08c',
        status: MeetingStatus.attended,
        minutes:
            'Curriculum overview, clubs and the co-curricular calendar were shared with parents.',
      ),
    ];
  }

  /// Slots for the next six school days (Mon-Fri). Some are already taken by other parents.
  static List<PtmSlot> slots(List<Teacher> teachers, {DateTime? now}) {
    final out = <PtmSlot>[];
    var day = dateOnly(now ?? DateTime.now());
    var days = 0;
    while (days < 6) {
      day = day.add(const Duration(days: 1));
      if (day.weekday > DateTime.friday) continue;
      for (final t in teachers) {
        for (var i = 0; i < slotStarts.length; i++) {
          final start = day.add(Duration(minutes: slotStarts[i]));
          out.add(
            PtmSlot(
              id: 'slot_${t.id}_${day.month}${day.day}_${slotStarts[i]}',
              teacherId: t.id,
              start: start,
              mins: slotMinutes,
              booked: (days + i + t.id.length) % 3 == 0,
            ),
          );
        }
      }
      days++;
    }
    return out;
  }
}
