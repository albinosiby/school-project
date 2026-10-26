import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';
import '../../constants/app_constants.dart';
import 'data_store.dart';

export 'data_store.dart' show DataStore, Rec, Seed, uid;

/// On-device JSON database persisted in SharedPreferences. Repositories (local
/// backend) are the only callers; screens never touch it directly.
/// [changes] emits the collection name after every write so BLoCs can refresh.
class LocalDatabaseService implements DataStore {
  LocalDatabaseService._(this._prefs, this._data);

  final SharedPreferences? _prefs;
  final Map<String, List<Rec>> _data;
  final _changes = StreamController<String>.broadcast();

  static Future<LocalDatabaseService> open(Seed seed) async {
    SharedPreferences? prefs;
    var data = <String, List<Rec>>{};
    try {
      prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(AppConstants.localDbKey);
      if (raw != null) {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        data = m.map((k, v) => MapEntry(k, [for (final r in v as List) Map<String, dynamic>.from(r as Map)]));
      }
    } catch (_) {}
    // collections added after the data was first saved are merged in from the seed
    seed.forEach((k, v) => data.putIfAbsent(k, () => _clone(v)));
    final db = LocalDatabaseService._(prefs, data);
    db._save();
    return db;
  }

  /// In-memory database for tests.
  factory LocalDatabaseService.memory(Seed seed) => LocalDatabaseService._(null, {for (final e in seed.entries) e.key: _clone(e.value)});

  static List<Rec> _clone(List<Rec> rows) => [for (final r in rows) jsonDecode(jsonEncode(r)) as Rec];

  @override
  Stream<String> get changes => _changes.stream;

  @override
  Stream<void> watch(Set<String> collections) => changes.where(collections.contains).map((_) {});

  @override
  Future<void> recordJoin(String sessionId) async {}

  @override
  List<Rec> list(String c) => List.unmodifiable(_data[c] ?? const []);

  @override
  Rec? byId(String c, String id) {
    for (final r in _data[c] ?? const <Rec>[]) {
      if (r['id'] == id) return r;
    }
    return null;
  }

  @override
  Rec doc(String c) => (_data[c]?.isNotEmpty ?? false) ? _data[c]!.first : <String, dynamic>{};

  @override
  Rec add(String c, Rec row, {bool prepend = true}) {
    final r = {...row, 'id': row['id'] ?? uid(c.substring(0, min(3, c.length)))};
    final l = _data.putIfAbsent(c, () => []);
    prepend ? l.insert(0, r) : l.add(r);
    _changed(c);
    return r;
  }

  @override
  Rec? update(String c, String id, Rec patch) {
    final l = _data[c];
    if (l == null) return null;
    final i = l.indexWhere((r) => r['id'] == id);
    if (i < 0) return null;
    l[i] = {...l[i], ...patch, 'id': id};
    _changed(c);
    return l[i];
  }

  @override
  void setDoc(String c, Rec patch) {
    final l = _data.putIfAbsent(c, () => []);
    if (l.isEmpty) {
      l.add({'id': c, ...patch});
    } else {
      l[0] = {...l[0], ...patch};
    }
    _changed(c);
  }

  @override
  bool remove(String c, String id) {
    final i = _data[c]?.indexWhere((r) => r['id'] == id) ?? -1;
    if (i < 0) return false;
    _data[c]!.removeAt(i);
    _changed(c);
    return true;
  }

  Future<void> reset(Seed seed) async {
    final names = {..._data.keys, ...seed.keys};
    _data
      ..clear()
      ..addAll({for (final e in seed.entries) e.key: _clone(e.value)});
    _save();
    names.forEach(_changes.add);
  }

  void _changed(String c) {
    _save();
    _changes.add(c);
  }

  void _save() {
    try {
      _prefs?.setString(AppConstants.localDbKey, jsonEncode(_data));
    } catch (_) {}
  }
}
