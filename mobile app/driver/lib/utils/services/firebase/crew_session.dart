import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../modules/auth/models/auth_models.dart';
import '../../../modules/crew/models/crew_models.dart';
import '../../exceptions/app_exception.dart';

typedef Json = Map<String, dynamic>;

/// The signed-in crew member's school, crew id and bus (data contract 14.1).
///
/// `users/{uid}` holds `schoolId`, `role` and `crewId`; the bus comes from `tr_crew/{crewId}.busId`, which the admin web
/// changes when the crew member is allotted to another bus. Repositories read everything through here.
///
/// Firestore's offline cache makes every read cache-first: a snapshot listener gets the cached copy at once and the
/// server copy when it arrives (stale-while-revalidate without a separate cache).
class CrewSession {
  CrewSession({FirebaseFirestore? db, FirebaseAuth? auth})
      : db = db ?? FirebaseFirestore.instance,
        auth = auth ?? FirebaseAuth.instance;
  final FirebaseFirestore db;
  final FirebaseAuth auth;

  CrewUser? _user;
  CrewMember? _me;
  var _ready = Completer<void>();

  /// Completes once the signed-in crew member's `users` doc is loaded.
  Future<void> get ready => _ready.future;

  /// [build] once the session is ready (for streams that start before sign-in ends).
  Stream<T> whenReady<T>(Stream<T> Function() build) =>
      _user != null ? build() : Stream.fromFuture(ready).asyncExpand((_) => build());

  String get uid => auth.currentUser?.uid ?? '';
  CrewUser? get user => _user;
  String get schoolId => _user?.schoolId ?? '';
  String get crewId => _user?.crewId ?? '';
  CrewRole get role => _user?.role ?? CrewRole.driver;
  CrewMember? get me => _me;
  String get busId => _me?.busId ?? '';

  DocumentReference<Json> get userDoc => db.collection('users').doc(uid);
  DocumentReference<Json> get schoolDoc => db.collection('schools').doc(schoolId);
  CollectionReference<Json> col(String name) => schoolDoc.collection(name);
  DocumentReference<Json> get crewDoc => col('tr_crew').doc(crewId);

  /// Loads `users/{uid}` and `tr_crew/{crewId}`; throws when the login is not a crew login.
  Future<CrewUser> load() async {
    if (uid.isEmpty) throw AppException(message: 'Not signed in.', statusCode: 401);
    final snap = await userDoc.get();
    final d = snap.data();
    final role = '${d?['role'] ?? ''}';
    if (d == null || '${d['schoolId'] ?? ''}'.isEmpty) {
      throw AppException(message: 'This account is not linked to a school. Ask the transport office to create your login.', statusCode: 403);
    }
    if (role != 'driver' && role != 'attendant') {
      throw AppException(message: 'This app is for bus drivers and bus staff. This account is registered as $role.', statusCode: 403);
    }
    final crewId = '${d['crewId'] ?? ''}';
    if (crewId.isEmpty) {
      throw AppException(message: 'Your login has no crew profile yet. Ask the transport office to complete it.', statusCode: 403);
    }
    _user = CrewUser(
      uid: uid,
      email: '${d['email'] ?? auth.currentUser?.email ?? ''}',
      name: '${d['name'] ?? ''}',
      schoolId: '${d['schoolId']}',
      crewId: crewId,
      role: CrewRoleX.parse(role),
    );
    final crew = await crewDoc.get();
    final c = crew.data();
    if (c != null) _me = CrewMember.fromJson(c, id: crewId);
    if (!_ready.isCompleted) _ready.complete();
    return _user!;
  }

  /// `tr_crew/{crewId}` as it changes (bus allotment, status).
  Stream<CrewMember> watchMe() => crewDoc.snapshots().map((s) {
        final d = s.data();
        if (d == null) throw AppException(message: 'Your crew profile was removed. Contact the transport office.', statusCode: 403);
        return _me = CrewMember.fromJson(d, id: crewId);
      });

  void clear() {
    _user = null;
    _me = null;
    if (_ready.isCompleted) _ready = Completer<void>();
  }
}

/// Now as a UTC ISO string, the format every app writes (`2026-10-27T04:25:00.000Z`).
String nowUtc() => DateTime.now().toUtc().toIso8601String();

String isoDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String isoMonth(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

String hhmm(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
