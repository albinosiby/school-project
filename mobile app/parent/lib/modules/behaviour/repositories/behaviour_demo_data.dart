import '../../../di/demo_data.dart';
import '../../../utils/helpers/date_helper.dart';
import '../models/behaviour_models.dart';

/// Demo conduct records, relative to "now" (Aarav: one open guidance note; Ananya: clean).
class BehaviourDemoData {
  BehaviourDemoData._();

  static DateTime _at(DateTime t, int daysAgo, int h, int m) =>
      plusDays(-daysAgo, from: t).add(Duration(hours: h, minutes: m));

  static BehaviourReport report(String childId, {DateTime? now}) {
    final t = dateOnly(now ?? DateTime.now());
    return childId == DemoData.aarav.id
        ? _aarav(childId, t)
        : _ananya(childId, t);
  }

  static BehaviourReport _aarav(String id, DateTime t) => BehaviourReport(
    childId: id,
    rank: 3,
    percentile: 'Top 1% conduct percentile in Grade 10 cohorts',
    entries: [
      ConductEntry(
        id: 'cd_${id}_1',
        childId: id,
        title: 'Academic Leadership',
        badge: 'Star Badge',
        kind: ConductKind.praise,
        category: ConductCategory.academic,
        teacher: 'Mrs. Anita Sharma',
        at: _at(t, 0, 11, 20),
        merits: 25,
        note:
            'Exceptional leadership in quadratic equations review. Guided peers through complex problems with exemplary patience.',
        tags: const ['Logged to Portfolio'],
      ),
      ConductEntry(
        id: 'cd_${id}_2',
        childId: id,
        title: 'Consistent Diligence',
        badge: 'Mastery Badge',
        kind: ConductKind.praise,
        category: ConductCategory.diligence,
        teacher: 'Mrs. Sunita Kapoor',
        at: _at(t, 1, 14, 15),
        merits: 15,
        note:
            'Consistently submitted calculus practice sets ahead of time with zero calculation errors. Remarkable focus.',
        tags: const ['Classroom Practice'],
        verified: 'Verified Entry',
      ),
      ConductEntry(
        id: 'cd_${id}_3',
        childId: id,
        title: 'Late Homework Submission',
        badge: 'Guidance Note',
        kind: ConductKind.guidance,
        category: ConductCategory.conduct,
        teacher: 'Mr. Imran Khan',
        at: _at(t, 3, 12, 40),
        merits: -5,
        note:
            'The Computer Science worksheet was handed in a day late. Please help Aarav plan the week\'s assignments.',
        tags: const ['Classroom Note'],
        requiresAck: true,
      ),
      ConductEntry(
        id: 'cd_${id}_4',
        childId: id,
        title: 'Civic Responsibility',
        badge: 'Prefect Badge',
        kind: ConductKind.praise,
        category: ConductCategory.civic,
        teacher: 'Dr. K. V. Rao',
        at: _at(t, 6, 8, 45),
        merits: 20,
        note:
            'Outstanding responsibility coordinating student assembly during rain. Kept junior cohorts safe and organized.',
        tags: const ['Assembly Commendation'],
        verified: 'Institutional Honor',
        commendation: true,
      ),
      ConductEntry(
        id: 'cd_${id}_5',
        childId: id,
        title: 'Punctuality Star',
        badge: 'Monthly Badge',
        kind: ConductKind.praise,
        category: ConductCategory.punctuality,
        teacher: 'Automated Gate Sync',
        at: _at(t, 9, 8, 0),
        merits: 10,
        highlight: '100% On-Time',
        note:
            '42 consecutive days with zero delays or early departures verified via campus RFID terminal.',
        tags: const ['Main Gate Terminal A-3'],
        verified: 'Perfect Attendance',
      ),
      ConductEntry(
        id: 'cd_${id}_6',
        childId: id,
        title: 'Science Fair Finalist',
        badge: 'Honour Badge',
        kind: ConductKind.praise,
        category: ConductCategory.academic,
        teacher: 'Ms. Priya Menon',
        at: _at(t, 14, 13, 30),
        merits: 30,
        note:
            'Represented the school at the inter-school science fair with a working water-purifier model.',
        tags: const ['Inter-school Event'],
        verified: 'Verified Entry',
        commendation: true,
      ),
      ConductEntry(
        id: 'cd_${id}_7',
        childId: id,
        title: 'Uniform Reminder',
        badge: 'Guidance Note',
        kind: ConductKind.guidance,
        category: ConductCategory.conduct,
        teacher: 'Mrs. Anita Sharma',
        at: _at(t, 20, 8, 20),
        merits: -2,
        note: 'Came to school without the house tie on Monday assembly.',
        tags: const ['Assembly'],
        requiresAck: true,
        acknowledged: true,
        parentNote: 'Noted, thank you. It has been replaced.',
      ),
      ConductEntry(
        id: 'cd_${id}_8',
        childId: id,
        title: 'Team Spirit',
        badge: 'Sports Badge',
        kind: ConductKind.praise,
        category: ConductCategory.sports,
        teacher: 'Mr. Joseph Mathew',
        at: _at(t, 25, 15, 10),
        merits: 12,
        note:
            'Captained the house football team with fairness and encouraged every player.',
        tags: const ['Sports Period'],
      ),
    ],
    remarks: [
      TeacherRemark(
        teacher: 'Mrs. Anita Sharma',
        subject: 'Class teacher',
        text:
            'Aarav is attentive and helps classmates willingly. Planning homework across subjects is the one habit to work on this term.',
        at: _at(t, 2, 16, 0),
      ),
      TeacherRemark(
        teacher: 'Mr. Imran Khan',
        subject: 'Computer Science',
        text:
            'Strong logical thinking in lab sessions. Needs to submit worksheets on time.',
        at: _at(t, 3, 12, 45),
      ),
    ],
  );

  static BehaviourReport _ananya(String id, DateTime t) => BehaviourReport(
    childId: id,
    rank: 7,
    percentile: 'Top 5% conduct percentile in Grade 8 cohorts',
    entries: [
      ConductEntry(
        id: 'cd_${id}_1',
        childId: id,
        title: 'Creative Writing',
        badge: 'Star Badge',
        kind: ConductKind.praise,
        category: ConductCategory.academic,
        teacher: 'Ms. Priya Menon',
        at: _at(t, 1, 10, 5),
        merits: 20,
        note:
            'Wrote a thoughtful short story that was read out in the English period.',
        tags: const ['Logged to Portfolio'],
      ),
      ConductEntry(
        id: 'cd_${id}_2',
        childId: id,
        title: 'Library Volunteer',
        badge: 'Service Badge',
        kind: ConductKind.praise,
        category: ConductCategory.civic,
        teacher: 'Mr. Vikram Nair',
        at: _at(t, 5, 13, 0),
        merits: 15,
        note:
            'Helped re-shelve and catalogue the new arrivals during lunch breaks.',
        tags: const ['Library'],
        verified: 'Verified Entry',
        commendation: true,
      ),
      ConductEntry(
        id: 'cd_${id}_3',
        childId: id,
        title: 'Talking in Class',
        badge: 'Guidance Note',
        kind: ConductKind.guidance,
        category: ConductCategory.conduct,
        teacher: 'Mr. Suresh Pillai',
        at: _at(t, 12, 11, 30),
        merits: -2,
        note:
            'Was reminded twice to stay focused during the Mathematics test revision.',
        tags: const ['Classroom Note'],
        requiresAck: true,
        acknowledged: true,
      ),
    ],
    remarks: [
      TeacherRemark(
        teacher: 'Mr. Vikram Nair',
        subject: 'Class teacher',
        text:
            'Ananya is cheerful and responsible. Keep encouraging her reading habit.',
        at: _at(t, 4, 15, 30),
      ),
    ],
  );
}
