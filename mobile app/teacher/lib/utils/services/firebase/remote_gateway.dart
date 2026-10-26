import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../data_store.dart';
import 'store_adapters.dart';

/// The only thing [FirestoreDataStore] needs from the network, so tests can replace Firestore with a fake.
abstract class RemoteGateway {
  /// Selects the school (`schools/{schoolId}/...`) all other calls operate on.
  void bind(String schoolId);

  /// Live result of [query]: a full snapshot (docs with their `id`) on every change; cached data first when offline.
  Stream<List<Rec>> watch(RemoteQuery query);

  /// Ids of the docs in `{collection}/{id}/{sub}` (live).
  Stream<List<String>> watchSubIds(String collection, String id, String sub);

  /// Replaces the top-level fields of [data] in the doc (creating it if needed); other fields are kept.
  Future<void> set(String collection, String id, Rec data);

  Future<void> delete(String collection, String id);

  Future<void> setSub(String collection, String id, String sub, String subId, Rec data);
}

/// Firestore implementation. Offline persistence (enabled by default on mobile) serves cached snapshots instantly.
class FirestoreGateway implements RemoteGateway {
  FirestoreGateway([FirebaseFirestore? firestore]) : _fs = firestore;
  FirebaseFirestore? _fs;
  String? _school;

  FirebaseFirestore get _db => _fs ??= FirebaseFirestore.instance;

  @override
  void bind(String schoolId) => _school = schoolId;

  CollectionReference<Map<String, dynamic>> _col(String c) => _db.collection('schools/$_school/$c');

  @override
  Stream<List<Rec>> watch(RemoteQuery q) {
    Query<Map<String, dynamic>> query = _col(q.collection);
    q.eq.forEach((k, v) => query = query.where(k == '__name__' ? FieldPath.documentId : k, isEqualTo: v));
    if (q.inField != null) query = query.where(q.inField == '__name__' ? FieldPath.documentId : q.inField!, whereIn: q.inValues);
    return query.snapshots().map((s) => [for (final d in s.docs) {...decode(d.data()), 'id': d.id}]);
  }

  @override
  Stream<List<String>> watchSubIds(String collection, String id, String sub) =>
      _col(collection).doc(id).collection(sub).snapshots().map((s) => [for (final d in s.docs) d.id]);

  @override
  Future<void> set(String collection, String id, Rec data) =>
      _col(collection).doc(id).set(data, SetOptions(mergeFields: data.keys.toList()));

  @override
  Future<void> delete(String collection, String id) => _col(collection).doc(id).delete();

  @override
  Future<void> setSub(String collection, String id, String sub, String subId, Rec data) =>
      _col(collection).doc(id).collection(sub).doc(subId).set({...data, 'joinedAt': FieldValue.serverTimestamp()}, SetOptions(merge: true));

  /// Firestore types -> JSON types (Timestamp -> ISO string).
  static dynamic decodeValue(Object? v) => switch (v) {
        Timestamp t => t.toDate().toIso8601String(),
        Map m => {for (final e in m.entries) '${e.key}': decodeValue(e.value)},
        List l => [for (final e in l) decodeValue(e)],
        _ => v,
      };

  static Rec decode(Map<String, dynamic> d) => {for (final e in d.entries) e.key: decodeValue(e.value)};
}
