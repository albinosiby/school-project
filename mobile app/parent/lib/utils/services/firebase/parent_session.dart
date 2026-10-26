import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../exceptions/app_exception.dart';

typedef Json = Map<String, dynamic>;

/// The signed-in guardian's school and children (data contract §13.1).
///
/// `users/{uid}` holds `schoolId`, `studentIds`, `classIds` and `grns`; a Cloud Function keeps the arrays equal to the
/// students linked to this login. Repositories read everything through here so they only ever query the children's data.
///
/// Firestore's offline cache makes every read cache-first: a snapshot listener gets the cached copy at once and the
/// server copy when it arrives (stale-while-revalidate without a separate cache).
class ParentSession {
  ParentSession({FirebaseFirestore? db, FirebaseAuth? auth})
      : db = db ?? FirebaseFirestore.instance,
        auth = auth ?? FirebaseAuth.instance;
  final FirebaseFirestore db;
  final FirebaseAuth auth;

  Json _user = const {};
  final Map<String, Json> _students = {};

  String get uid => auth.currentUser?.uid ?? '';
  String get schoolId => '${_user['schoolId'] ?? ''}';
  Json get user => _user;
  List<String> get studentIds => _list(_user['studentIds']);
  List<String> get classIds => _list(_user['classIds']);
  List<String> get grns => _list(_user['grns']);

  DocumentReference<Json> get userDoc => db.collection('users').doc(uid);
  DocumentReference<Json> get schoolDoc => db.collection('schools').doc(schoolId);
  CollectionReference<Json> col(String name) => schoolDoc.collection(name);

  /// Loads `users/{uid}`; throws when the login is not a parent login.
  Future<Json> load() async {
    if (uid.isEmpty) throw AppException(message: 'Not signed in.', statusCode: 401);
    final snap = await userDoc.get();
    final data = snap.data();
    if (data == null || data['role'] != 'parent' || '${data['schoolId'] ?? ''}'.isEmpty) {
      throw AppException(
        message: 'This account is not a parent login. Ask the school office to add your email to your child\'s record.',
        statusCode: 403,
      );
    }
    _user = data;
    return data;
  }

  /// `users/{uid}` as it changes (children linked or unlinked by the school).
  Stream<Json> watchUser() => userDoc.snapshots().map((s) => _user = s.data() ?? _user);

  /// The child's `students` doc (cached after the first read).
  Future<Json> student(String studentId) async {
    final hit = _students[studentId];
    if (hit != null) return hit;
    final s = await col('students').doc(studentId).get();
    return _students[studentId] = {...?s.data(), 'id': studentId};
  }

  /// The child's doc if it has been read already.
  Json? cached(String studentId) => _students[studentId];

  void remember(String studentId, Json data) => _students[studentId] = {...data, 'id': studentId};

  Future<String> classIdOf(String studentId) async => '${(await student(studentId))['classId'] ?? ''}';
  Future<String> grnOf(String studentId) async => '${(await student(studentId))['grn'] ?? ''}';

  void clear() {
    _user = const {};
    _students.clear();
  }

  static List<String> _list(Object? v) => v is List ? [for (final e in v) '$e'] : const [];
}

/// Latest value of every stream in [streams], emitted whenever one changes (after each has emitted once).
Stream<List<T>> combineLatest<T>(List<Stream<T>> streams) {
  if (streams.isEmpty) return Stream.value(<T>[]);
  late StreamController<List<T>> out;
  final subs = <StreamSubscription<T>>[];
  final values = List<T?>.filled(streams.length, null);
  final seen = List<bool>.filled(streams.length, false);
  out = StreamController<List<T>>(
    onListen: () {
      for (var i = 0; i < streams.length; i++) {
        subs.add(streams[i].listen((v) {
          values[i] = v;
          seen[i] = true;
          if (seen.every((s) => s)) out.add(List<T>.from(values));
        }, onError: out.addError));
      }
    },
    onCancel: () async {
      for (final s in subs) {
        await s.cancel();
      }
    },
  );
  return out.stream;
}

/// `"2026-10-27"` (+ optional `"09:15"`) -> local DateTime; null when unparsable.
DateTime? parseDay(Object? date, [Object? time]) {
  final d = DateTime.tryParse('${date ?? ''}'.split('T').first);
  if (d == null) return null;
  final t = '${time ?? ''}'.split(':');
  final h = int.tryParse(t.first), m = t.length > 1 ? int.tryParse(t[1]) : null;
  return DateTime(d.year, d.month, d.day, h ?? 0, m ?? 0);
}

/// ISO string, Firestore Timestamp or millis -> DateTime.
/// Times are stored as UTC ISO strings (`...Z`); the result is always local time for display.
DateTime? parseTime(Object? v) => switch (v) {
      Timestamp t => t.toDate(),
      int ms => DateTime.fromMillisecondsSinceEpoch(ms),
      String s => DateTime.tryParse(s)?.toLocal(),
      _ => null,
    };

/// Now as a UTC ISO string, the format every app writes (`2026-10-27T04:25:00.000Z`).
String nowUtc() => DateTime.now().toUtc().toIso8601String();

String isoDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
