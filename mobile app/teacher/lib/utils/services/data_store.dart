import 'dart:async';
import 'dart:math';

/// One record: a JSON map with a String `id`.
typedef Rec = Map<String, dynamic>;

/// Seed data: collection name -> records.
typedef Seed = Map<String, List<Rec>>;

String uid([String prefix = 'id']) =>
    '${prefix}_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${Random().nextInt(1 << 20).toRadixString(36)}';

/// Synchronous collection store that every repository reads and writes. Two implementations:
/// the on-device JSON database (`LocalDatabaseService`) and the Firestore mirror (`FirestoreDataStore`).
/// Reads are always synchronous (cache / mirror); [changes] emits the collection name after every change.
abstract class DataStore {
  Stream<String> get changes;

  /// Emits whenever any of [collections] changes.
  Stream<void> watch(Set<String> collections) => changes.where(collections.contains).map((_) {});

  List<Rec> list(String c);
  Rec? byId(String c, String id);

  /// First record of a single-document collection (e.g. `me`).
  Rec doc(String c);

  Rec add(String c, Rec row, {bool prepend = true});
  Rec? update(String c, String id, Rec patch);
  void setDoc(String c, Rec patch);
  bool remove(String c, String id);

  /// Records that the signed-in user opened a live class link (`live_classes/{id}/joins/{uid}`). No-op locally.
  Future<void> recordJoin(String sessionId) async {}
}
