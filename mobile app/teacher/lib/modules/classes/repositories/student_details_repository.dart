import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../utils/exceptions/app_exception.dart';
import '../../../utils/services/data_store.dart';
import '../models/student_details.dart';
import 'student_details_repository_interface.dart';

/// Firebase: the `getClassStudentDetails` / `updateClassStudentDetails` callables (class teacher only, checked on the
/// server). The cache lives in memory for the signed-in teacher only, so contacts and medical notes never stay on
/// the phone after sign-out.
class FirebaseStudentDetailsRepository implements IStudentDetailsRepository {
  FirebaseStudentDetailsRepository([FirebaseFunctions? functions]) : _fn = functions ?? FirebaseFunctions.instanceFor(region: 'asia-south1');
  final FirebaseFunctions _fn;
  final _cache = <String, StudentDetails>{};
  String _owner = '';

  String get _uid => FirebaseAuth.instance.currentUser?.uid ?? '';
  StudentDetails? _cached(String id) {
    if (_owner != _uid) {
      _cache.clear();
      _owner = _uid;
    }
    return _cache[id];
  }

  @override
  Stream<StudentDetails> watch(String studentId) async* {
    final hit = _cached(studentId);
    if (hit != null) yield hit;
    try {
      final r = await _fn.httpsCallable('getClassStudentDetails').call({'studentId': studentId});
      final d = StudentDetails.fromJson(studentId, {...Map<String, dynamic>.from(r.data as Map), 'fetchedAt': DateTime.now().toIso8601String()});
      _cache[studentId] = d;
      yield d;
    } on FirebaseFunctionsException catch (e) {
      if (hit == null) throw AppException(message: e.message ?? 'Could not load the student details.');
    } catch (_) {
      if (hit == null) throw AppException(message: 'Could not load the student details. Check your connection.');
    }
  }

  @override
  Future<StudentDetails> update(String studentId, StudentDetailsPatch patch) async {
    try {
      final r = await _fn.httpsCallable('updateClassStudentDetails').call({'studentId': studentId, ...patch.toJson()});
      final d = StudentDetails.fromJson(studentId, {...Map<String, dynamic>.from(r.data as Map), 'fetchedAt': DateTime.now().toIso8601String()});
      _cached(studentId);
      _cache[studentId] = d;
      return d;
    } on FirebaseFunctionsException catch (e) {
      throw AppException(message: e.message ?? 'Could not save the changes.');
    } catch (_) {
      throw AppException(message: 'Could not save the changes. Check your connection.');
    }
  }
}

/// Local / demo backend: records in the `student_details` collection (seeded), falling back to the student row.
class LocalStudentDetailsRepository implements IStudentDetailsRepository {
  LocalStudentDetailsRepository(this._db);
  final DataStore _db;
  static const _col = 'student_details';

  StudentDetails _read(String id) {
    final row = _db.byId(_col, id);
    final st = _db.byId('students', id) ?? const {};
    if (row != null) return StudentDetails.fromJson(id, {...row, 'exists': true});
    return StudentDetails.fromJson(id, {
      'gender': st['gender'],
      'dob': st['dob'],
      'contacts': {
        'guardian': {'name': st['guardian'], 'phone': st['phone'], 'relationship': st['relation'] ?? ''},
      },
      'primary': 'guardian',
      'admissionNumber': st['adm'],
      'admissionDate': st['admissionDate'],
      'bus': st['bus'],
      'busStop': st['busStop'],
    });
  }

  @override
  Stream<StudentDetails> watch(String studentId) async* {
    yield _read(studentId);
  }

  @override
  Future<StudentDetails> update(String studentId, StudentDetailsPatch patch) async {
    final next = patch.applyTo(_read(studentId));
    final row = {...next.toJson(), 'id': studentId};
    if (_db.byId(_col, studentId) == null) {
      _db.add(_col, row);
    } else {
      _db.update(_col, studentId, row);
    }
    final main = next.contact(next.primary);
    if (patch.contacts != null || patch.primary != null) {
      _db.update('students', studentId, {'guardian': main.name, 'phone': main.phone});
    }
    return next;
  }
}
