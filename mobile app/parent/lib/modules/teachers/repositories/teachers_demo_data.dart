import '../../../di/demo_data.dart';
import '../models/teacher_models.dart';

/// Demo teachers, consistent with the timetable in `di/demo_data.dart` (same names, subjects and rooms).
/// Thread ids reuse the existing message threads (`th_<child>_ct` class teacher, `th_<child>_st` subject teacher).
class TeachersDemoData {
  TeachersDemoData._();

  static const receptionPhone = '+91 11 4055 1200';

  static TeachersData forChild(String childId) {
    final child = DemoData.childById(childId);
    final aarav = childId == DemoData.aarav.id;
    String thread(String teacherId, {bool ct = false, bool st = false}) => ct
        ? 'th_${childId}_ct'
        : st
        ? 'th_${childId}_st'
        : 'th_${childId}_$teacherId';

    final faculty = aarav
        ? [
            Teacher(
              id: 'tch_anita',
              name: 'Mrs. Anita Sharma',
              qualification: 'M.Sc.',
              subject: 'Mathematics & Science',
              designation: 'PGT',
              room: 'Room 204',
              category: TeacherCategory.coreSciences,
              phone: '+91 98100 22041',
              email: 'anita.sharma@greenfield.edu.in',
              officeHours: '02:30 - 03:30 PM',
              threadId: thread('tch_anita', ct: true),
              isClassTeacher: true,
            ),
            Teacher(
              id: 'tch_imran',
              name: 'Mr. Imran Khan',
              qualification: 'MCA',
              subject: 'Computer Science',
              designation: 'HOD',
              room: 'IT Lab',
              category: TeacherCategory.coreSciences,
              phone: '+91 98100 22077',
              email: 'imran.khan@greenfield.edu.in',
              officeHours: '01:45 - 02:30 PM',
              threadId: thread('tch_imran', st: true),
            ),
            Teacher(
              id: 'tch_priya',
              name: 'Ms. Priya Menon',
              qualification: 'M.A.',
              subject: 'English Literature & Language',
              designation: 'TGT',
              room: 'Room 204',
              category: TeacherCategory.languages,
              phone: '+91 98100 22052',
              email: 'priya.menon@greenfield.edu.in',
              officeHours: '12:50 - 01:30 PM',
              threadId: thread('tch_priya'),
            ),
            Teacher(
              id: 'tch_kavita',
              name: 'Mrs. Kavita Rao',
              qualification: 'M.A.',
              subject: 'Hindi',
              designation: 'TGT',
              room: 'Room 204',
              category: TeacherCategory.languages,
              phone: '+91 98100 22063',
              email: 'kavita.rao@greenfield.edu.in',
              officeHours: '11:00 - 11:40 AM',
              threadId: thread('tch_kavita'),
            ),
            Teacher(
              id: 'tch_joseph',
              name: 'Mr. Joseph Mathew',
              qualification: 'M.A.',
              subject: 'Social Science & Economics',
              designation: 'PGT',
              room: 'Room 204',
              category: TeacherCategory.electives,
              phone: '+91 98100 22058',
              email: 'joseph.mathew@greenfield.edu.in',
              officeHours: '02:00 - 02:40 PM',
              threadId: thread('tch_joseph'),
            ),
            Teacher(
              id: 'tch_daniel',
              name: 'Mr. Daniel George',
              qualification: 'B.P.Ed.',
              subject: 'Physical Education',
              designation: 'TGT',
              room: 'Ground',
              category: TeacherCategory.electives,
              phone: '+91 98100 22090',
              email: 'daniel.george@greenfield.edu.in',
              officeHours: '03:00 - 03:30 PM',
              threadId: thread('tch_daniel'),
            ),
          ]
        : [
            Teacher(
              id: 'tch_vikram',
              name: 'Mr. Vikram Nair',
              qualification: 'M.Lib.',
              subject: 'Library & Reading',
              designation: 'TGT',
              room: 'Library',
              category: TeacherCategory.electives,
              phone: '+91 98100 22033',
              email: 'vikram.nair@greenfield.edu.in',
              officeHours: '02:30 - 03:15 PM',
              threadId: thread('tch_vikram', ct: true),
              isClassTeacher: true,
            ),
            Teacher(
              id: 'tch_suresh',
              name: 'Mr. Suresh Pillai',
              qualification: 'M.Sc.',
              subject: 'Mathematics',
              designation: 'TGT',
              room: 'Room 108',
              category: TeacherCategory.coreSciences,
              phone: '+91 98100 22045',
              email: 'suresh.pillai@greenfield.edu.in',
              officeHours: '01:00 - 01:40 PM',
              threadId: thread('tch_suresh'),
            ),
            Teacher(
              id: 'tch_anita',
              name: 'Mrs. Anita Sharma',
              qualification: 'M.Sc.',
              subject: 'Physics',
              designation: 'PGT',
              room: 'Lab 1',
              category: TeacherCategory.coreSciences,
              phone: '+91 98100 22041',
              email: 'anita.sharma@greenfield.edu.in',
              officeHours: '02:30 - 03:30 PM',
              threadId: thread('tch_anita'),
            ),
            Teacher(
              id: 'tch_priya',
              name: 'Ms. Priya Menon',
              qualification: 'M.A.',
              subject: 'English',
              designation: 'TGT',
              room: 'Room 108',
              category: TeacherCategory.languages,
              phone: '+91 98100 22052',
              email: 'priya.menon@greenfield.edu.in',
              officeHours: '12:50 - 01:30 PM',
              threadId: thread('tch_priya', st: true),
            ),
            Teacher(
              id: 'tch_kavita',
              name: 'Mrs. Kavita Rao',
              qualification: 'M.A.',
              subject: 'Hindi',
              designation: 'TGT',
              room: 'Room 108',
              category: TeacherCategory.languages,
              phone: '+91 98100 22063',
              email: 'kavita.rao@greenfield.edu.in',
              officeHours: '11:00 - 11:40 AM',
              threadId: thread('tch_kavita'),
            ),
            Teacher(
              id: 'tch_joseph',
              name: 'Mr. Joseph Mathew',
              qualification: 'M.A.',
              subject: 'Social Science',
              designation: 'PGT',
              room: 'Room 108',
              category: TeacherCategory.electives,
              phone: '+91 98100 22058',
              email: 'joseph.mathew@greenfield.edu.in',
              officeHours: '02:00 - 02:40 PM',
              threadId: thread('tch_joseph'),
            ),
            Teacher(
              id: 'tch_leena',
              name: 'Ms. Leena Thomas',
              qualification: 'BFA',
              subject: 'Art & Design',
              designation: 'TGT',
              room: 'Art Room',
              category: TeacherCategory.electives,
              phone: '+91 98100 22071',
              email: 'leena.thomas@greenfield.edu.in',
              officeHours: '12:00 - 12:40 PM',
              threadId: thread('tch_leena'),
            ),
          ];
    return TeachersData(
      className: child.className,
      classTeacher: faculty.firstWhere((t) => t.isClassTeacher),
      faculty: faculty,
      receptionPhone: receptionPhone,
    );
  }
}
