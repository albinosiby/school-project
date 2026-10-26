import '../../../di/demo_fixture.g.dart';
import '../../../utils/services/local_database_service.dart';

/// Seed for the shared school data every module reads: the teacher, the school, the classes she teaches and their students.
/// The shared part comes from the demo fixture (website/tools/demo_fixture, DATA_CONTRACT §8) so ids and names are the
/// same as in the admin web: teacher stf_025 Mrs. Anita Sharma, classes cls_10B / cls_9A / cls_8C / cls_10A.
const teacherStaffId = 'stf_025';

/// Classes in the order the app lists them (class teacher of 10-B first).
const _classOrder = ['cls_10B', 'cls_9A', 'cls_8C', 'cls_10A'];

// local-only class extras (not shared with the admin)
const _rep = {'cls_10B': 'Aarav S.', 'cls_9A': 'Diya M.', 'cls_8C': 'Kabir N.', 'cls_10A': 'Isha P.'};
const _attendance = {'cls_10B': 92.4, 'cls_9A': 90.1, 'cls_8C': 88.7, 'cls_10A': 93.0};

Map<String, dynamic> _staff() => fixtureStaff.firstWhere((s) => s['id'] == teacherStaffId);

List<Rec> _classes() => [
      for (final id in _classOrder)
        () {
          final c = fixtureClasses.firstWhere((c) => c['id'] == id);
          final a = fixtureAssignments.firstWhere((a) => a['classId'] == id && a['teacherId'] == teacherStaffId);
          return <String, dynamic>{
            'id': id, 'grade': c['grade'], 'section': c['section'], 'subject': a['subject'], 'topic': a['topic'] ?? '', 'room': c['room'], 'wing': c['wing'],
            'students': c['studentCount'], 'classTeacher': c['classTeacherId'] == teacherStaffId, 'rep': _rep[id], 'attendance': _attendance[id],
          };
        }(),
    ];

List<Rec> _students() => [
      for (final id in _classOrder)
        for (final s in fixtureStudents.where((s) => s['classId'] == id))
          {
            'id': s['id'], 'name': s['name'], 'roll': s['roll'], 'classId': s['classId'], 'adm': s['grn'], 'guardian': s['guardian'], 'phone': s['phone'],
            'attendance': s['attendance'], 'grade': s['perfGrade'] ?? '',
          }
    ];

Rec _me() {
  final s = _staff();
  final name = '${s['name']}';
  return {
    'id': 'me', 'staffId': s['id'], 'name': name, 'short': name.split(' ').length > 1 ? name.split(' ')[1] : name, 'title': 'Sr. Secondary Teacher', 'subjects': s['subjects'],
    'designation': s['designation'], 'empId': s['empId'], 'school': fixtureSchool['name'], 'year': 'AY ${fixtureSchool['academicYear']}', 'term': fixtureSchool['term'],
    'email': s['email'], 'phone': s['phone'], 'joined': s['joined'], 'online': true,
  };
}

final Seed schoolSeed = {
  'me': [_me()],
  'classes': _classes(),
  'students': _students(),
};
