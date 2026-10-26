import '../../../utils/services/data_store.dart';
import '../models/school_models.dart';
import 'school_repository_interface.dart';

/// Local (on-device) implementation. A REST/Firebase version implements the same interface.
class LocalSchoolRepository implements ISchoolRepository {
  LocalSchoolRepository(this._db);
  final DataStore _db;

  @override
  Future<Teacher> getTeacher() async => Teacher.fromJson(_db.doc('me'));

  @override
  Future<void> updateTeacher(Teacher teacher) async => _db.setDoc('me', teacher.toJson());

  @override
  Future<List<SchoolClass>> getClasses() async => [for (final r in _db.list('classes')) SchoolClass.fromJson(r)];

  @override
  Future<List<Student>> getStudents({String? classId}) async =>
      [for (final r in _db.list('students')) if (classId == null || r['classId'] == classId) Student.fromJson(r)];

  @override
  Future<Student?> getStudent(String id) async {
    final r = _db.byId('students', id);
    return r == null ? null : Student.fromJson(r);
  }

  @override
  Stream<void> watch() => _db.watch({'me', 'classes', 'students'});
}
