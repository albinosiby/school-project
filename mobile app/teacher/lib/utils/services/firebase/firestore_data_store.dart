import 'dart:async';
import 'dart:math';
import '../data_store.dart';
import 'remote_gateway.dart';
import 'store_adapters.dart';

/// [DataStore] backed by the shared Firestore (`schools/{schoolId}/...`, see docs/DATA_CONTRACT.md).
///
/// - Realtime listeners fill an in-memory mirror of the remote docs; the local collections the repositories
///   read are built from it by per-collection adapters. Reads are synchronous, so cached data shows instantly
///   and works offline (Firestore persistence serves the listeners from its cache).
/// - Writes are applied to the mirror immediately (optimistic) and written through to Firestore.
/// - Collections load lazily on first read; [start] preloads the core ones.
class FirestoreDataStore implements DataStore {
  FirestoreDataStore(this._gateway, {List<StoreAdapter>? adapters, this._onError}) : _adapters = {for (final a in adapters ?? defaultAdapters()) a.local: a};

  final RemoteGateway _gateway;
  final Map<String, StoreAdapter> _adapters;
  final void Function(Object error, StackTrace? stack)? _onError;

  AdapterContext? _ctx;
  final Set<String> _active = {};
  final Map<String, Map<String, Rec>> _mirror = {}; // remote collection -> id -> doc
  final Map<String, Map<String, Set<String>>> _owners = {}; // remote collection -> id -> query keys
  final Map<String, RemoteQuery> _queries = {};
  final Map<String, StreamSubscription<List<Rec>>> _querySubs = {};
  final Map<String, StreamSubscription<List<String>>> _joinSubs = {};
  final Map<String, Set<String>> _joinIds = {};
  final Map<String, List<Rec>> _local = {};
  final _changes = StreamController<String>.broadcast();

  bool get started => _ctx != null;
  AdapterContext? get context => _ctx;

  @override
  Stream<String> get changes => _changes.stream;

  @override
  Stream<void> watch(Set<String> collections) {
    collections.forEach(_ensure);
    return changes.where(collections.contains).map((_) {});
  }

  /// Binds the store to the signed-in teacher and starts the listeners of the core collections.
  void start(AdapterContext ctx) {
    stop();
    _ctx = ctx;
    _gateway.bind(ctx.schoolId);
    _active.addAll(coreCollections);
    _sync();
    _rebuildAll();
  }

  /// Sign-out: drops listeners and every cached row.
  void stop() {
    final names = {..._active, ..._local.keys};
    for (final s in _querySubs.values) {
      s.cancel();
    }
    for (final s in _joinSubs.values) {
      s.cancel();
    }
    _querySubs.clear();
    _joinSubs.clear();
    _queries.clear();
    _mirror.clear();
    _owners.clear();
    _joinIds.clear();
    _local.clear();
    _active.clear();
    _ctx = null;
    names.forEach(_changes.add);
  }

  // --- reads -----------------------------------------------------------------

  StoreAdapter _adapter(String c) => _adapters.putIfAbsent(c, () => PrivateAdapter(c));

  void _ensure(String c) {
    if (_ctx == null || !_active.add(c)) return;
    _local[c] = _adapter(c).build(_ctx!, _remote());
    _sync();
  }

  @override
  List<Rec> list(String c) {
    _ensure(c);
    return List.unmodifiable(_local[c] ?? const []);
  }

  @override
  Rec? byId(String c, String id) {
    for (final r in list(c)) {
      if (r['id'] == id) return r;
    }
    return null;
  }

  @override
  Rec doc(String c) {
    final l = list(c);
    return l.isEmpty ? <String, dynamic>{} : l.first;
  }

  // --- writes ----------------------------------------------------------------

  @override
  Rec add(String c, Rec row, {bool prepend = true}) {
    final ctx = _ctx;
    final a = _adapter(c);
    final id = '${row['id'] ?? (ctx == null ? null : a.newId(ctx, row)) ?? uid(c.substring(0, min(3, c.length)))}';
    final ord = DateTime.now().microsecondsSinceEpoch * (prepend ? 1 : -1);
    final r = cleanRec({...row, 'id': id, 'ord': row['ord'] ?? ord});
    if (ctx == null) return r;
    _apply(a, r);
    return byId(c, id) ?? r;
  }

  @override
  Rec? update(String c, String id, Rec patch) {
    final ctx = _ctx;
    final cur = byId(c, id);
    if (ctx == null || cur == null) return null;
    _apply(_adapter(c), cleanRec({...cur, ...patch, 'id': id}));
    return byId(c, id);
  }

  @override
  void setDoc(String c, Rec patch) {
    final cur = list(c);
    if (cur.isEmpty) {
      add(c, {'id': c, ...patch});
    } else {
      update(c, '${cur.first['id']}', patch);
    }
  }

  @override
  bool remove(String c, String id) {
    final ctx = _ctx;
    final cur = byId(c, id);
    if (ctx == null || cur == null) return false;
    final writes = _adapter(c).delete(ctx, _remote(), cur);
    if (writes.isEmpty) return false;
    _commit(writes);
    return true;
  }

  @override
  Future<void> recordJoin(String sessionId) async {
    final ctx = _ctx;
    if (ctx == null) return;
    (_joinIds[sessionId] ??= {}).add(ctx.authUid);
    _setJoinCount(sessionId);
    _rebuild({LiveClassesAdapter.joinsSource});
    try {
      await _gateway.setSub('live_classes', sessionId, 'joins', ctx.authUid, {'authUid': ctx.authUid, 'teacherId': ctx.staffId});
    } catch (e, s) {
      _onError?.call(e, s);
      rethrow;
    }
  }

  void _apply(StoreAdapter a, Rec row) {
    final writes = a.write(_ctx!, _remote(), row);
    if (writes.isEmpty) {
      _onError?.call(StateError('${a.local} is read-only for this record'), null);
      return;
    }
    _commit(writes);
  }

  /// Optimistic mirror update + write-through.
  void _commit(List<RemoteWrite> writes) {
    final touched = <String>{};
    for (final w in writes) {
      final docs = _mirror.putIfAbsent(w.collection, () => {});
      if (w.delete) {
        docs.remove(w.id);
        _owners[w.collection]?.remove(w.id);
      } else {
        docs[w.id] = {...?docs[w.id], ...cleanRec(w.data), 'id': w.id};
      }
      touched.add(w.collection);
    }
    _rebuild(touched);
    for (final w in writes) {
      final f = w.delete ? _gateway.delete(w.collection, w.id) : _gateway.set(w.collection, w.id, cleanRec(w.data));
      f.catchError((Object e, StackTrace s) => _onError?.call(e, s));
    }
  }

  // --- listeners -------------------------------------------------------------

  Remote _remote() => {for (final e in _mirror.entries) e.key: e.value.values.toList()};

  /// Starts / stops listeners so they match what the active adapters currently ask for.
  void _sync() {
    final ctx = _ctx;
    if (ctx == null) return;
    final remote = _remote();
    final want = <String, RemoteQuery>{};
    for (final c in _active) {
      for (final q in _adapter(c).queries(ctx, remote)) {
        want[q.key] = q;
      }
    }
    for (final k in _querySubs.keys.toList()) {
      if (!want.containsKey(k)) {
        _querySubs.remove(k)!.cancel();
        _dropQuery(_queries.remove(k)!.collection, k);
      }
    }
    for (final e in want.entries) {
      if (_querySubs.containsKey(e.key)) continue;
      _queries[e.key] = e.value;
      _querySubs[e.key] = _gateway.watch(e.value).listen((docs) => _onSnapshot(e.value, docs), onError: (Object err, StackTrace s) => _onError?.call(err, s));
    }
  }

  void _onSnapshot(RemoteQuery q, List<Rec> docs) {
    if (_ctx == null) return;
    final mirror = _mirror.putIfAbsent(q.collection, () => {});
    final owners = _owners.putIfAbsent(q.collection, () => {});
    final ids = {for (final d in docs) '${d['id']}'};
    for (final d in docs) {
      final id = '${d['id']}';
      mirror[id] = d;
      (owners[id] ??= {}).add(q.key);
    }
    _dropQuery(q.collection, q.key, keep: ids);
    _rebuild({q.collection});
    _sync();
  }

  /// Forgets docs that only [queryKey] delivered (except [keep]).
  void _dropQuery(String collection, String queryKey, {Set<String> keep = const {}}) {
    final owners = _owners[collection];
    if (owners == null) return;
    final gone = <String>[];
    owners.forEach((id, keys) {
      if (keep.contains(id) || !keys.contains(queryKey)) return;
      keys.remove(queryKey);
      if (keys.isEmpty) gone.add(id);
    });
    for (final id in gone) {
      owners.remove(id);
      _mirror[collection]?.remove(id);
    }
    if (gone.isNotEmpty && keep.isEmpty) _rebuild({collection});
  }

  // --- local rebuild ---------------------------------------------------------

  void _rebuildAll() {
    _rebuild(_mirror.keys.toSet(), force: true);
  }

  void _rebuild(Set<String> remoteCollections, {bool force = false}) {
    final ctx = _ctx;
    if (ctx == null) return;
    if (remoteCollections.contains('live_classes')) _syncJoinListeners();
    final remote = _remote();
    for (final c in _active.toList()) {
      final a = _adapter(c);
      if (!force && a.sources.intersection(remoteCollections).isEmpty) continue;
      final built = a.build(ctx, remote);
      if (force || !_same(_local[c], built)) {
        _local[c] = built;
        _changes.add(c);
      }
    }
  }

  bool _same(List<Rec>? a, List<Rec> b) {
    if (a == null || a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if ('${a[i]}' != '${b[i]}') return false;
    }
    return true;
  }

  // --- live class joins ------------------------------------------------------

  void _syncJoinListeners() {
    final ids = {for (final d in _mirror['live_classes']?.values ?? const <Rec>[]) '${d['id']}'};
    for (final id in ids) {
      if (_joinSubs.containsKey(id)) continue;
      _joinSubs[id] = _gateway.watchSubIds('live_classes', id, 'joins').listen((uids) {
        _joinIds[id] = uids.toSet();
        _setJoinCount(id);
        _rebuild({LiveClassesAdapter.joinsSource});
      }, onError: (Object e, StackTrace s) => _onError?.call(e, s));
    }
    for (final id in _joinSubs.keys.toList()) {
      if (!ids.contains(id)) _joinSubs.remove(id)!.cancel();
    }
  }

  void _setJoinCount(String sessionId) =>
      _mirror.putIfAbsent(LiveClassesAdapter.joinsSource, () => {})[sessionId] = {'id': sessionId, 'count': _joinIds[sessionId]?.length ?? 0};
}
