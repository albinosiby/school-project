import '../../../utils/services/firebase/parent_session.dart';
import '../models/teacher_models.dart';
import 'teachers_repository_interface.dart';

/// The child's teachers: the class teacher (`classes.classTeacherId` / `classTeacher`) and the subject teachers of
/// the class timetable (`ops_periods`). Staff contact details are not shared with parents, so parents reach teachers
/// through Messages (`threadId` = the conversation id used by the messages repository).
class FirebaseTeachersRepository implements ITeachersRepository {
  FirebaseTeachersRepository(this._session);
  final ParentSession _session;

  static const _languages = {'English', 'Hindi', 'Sanskrit', 'French', 'German', 'Tamil', 'Malayalam', 'Kannada', 'Telugu'};
  static const _sciences = {'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'Computer Science'};

  @override
  Stream<TeachersData> watchTeachers(String childId) async* {
    final child = await _session.student(childId);
    final classId = '${child['classId'] ?? ''}';
    final className = '${child['grade'] ?? ''}-${child['section'] ?? ''}';
    final cls = classId.isEmpty ? const <String, dynamic>{} : ((await _session.col('classes').doc(classId).get()).data() ?? const {});
    final ctId = '${cls['classTeacherId'] ?? ''}';
    Teacher teacher(String id, String name, List<String> subjects) {
      final subject = subjects.where((s) => s.isNotEmpty).join(', ');
      return Teacher(
        id: id,
        name: name,
        subject: subject.isEmpty ? 'Class Teacher' : subject,
        designation: id == ctId ? 'Class Teacher, $className' : 'Subject Teacher',
        room: id == ctId ? '${cls['room'] ?? ''}' : '',
        category: subjects.any(_sciences.contains)
            ? TeacherCategory.coreSciences
            : subjects.any(_languages.contains)
                ? TeacherCategory.languages
                : TeacherCategory.electives,
        phone: '',
        email: '',
        officeHours: 'Message through the app',
        threadId: 'thr_${childId}_$id',
        isClassTeacher: id == ctId,
      );
    }

    if (classId.isEmpty) return;
    yield* _session.col('ops_periods').where('classId', isEqualTo: classId).snapshots().map((q) {
      final names = <String, String>{}, subjects = <String, Set<String>>{};
      for (final doc in q.docs) {
        final id = '${doc.data()['teacherId'] ?? ''}';
        if (id.isEmpty) continue;
        names[id] = '${doc.data()['teacher'] ?? ''}';
        (subjects[id] ??= {}).add('${doc.data()['subject'] ?? ''}');
      }
      final classTeacher = teacher(ctId, '${cls['classTeacher'] ?? names[ctId] ?? ''}', [...?subjects[ctId]]);
      return TeachersData(
        className: className,
        classTeacher: classTeacher,
        faculty: [
          for (final id in names.keys.where((id) => id != ctId)) teacher(id, names[id]!, [...?subjects[id]]),
        ]..sort((a, b) => a.name.compareTo(b.name)),
        receptionPhone: '${(_session.user['schoolPhone'] ?? '')}',
      );
    });
  }
}
