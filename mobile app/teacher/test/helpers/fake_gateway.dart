import 'dart:async';
import 'package:teacher_app/utils/services/data_store.dart';
import 'package:teacher_app/utils/services/firebase/remote_gateway.dart';
import 'package:teacher_app/utils/services/firebase/store_adapters.dart';

/// In-memory gateway: [load] pushes docs to every matching listener (filters honoured like Firestore would).
class FakeGateway implements RemoteGateway {
  String? bound;
  final Map<RemoteQuery, StreamController<List<Rec>>> _ctrls = {};
  final Map<String, List<Rec>> _data = {};
  final List<RemoteWrite> writes = [];
  final List<(String, String, String, String)> joins = [];

  int get activeListeners => _ctrls.values.where((c) => c.hasListener).length;

  void load(Remote data) {
    data.forEach((c, docs) => _data[c] = [...?_data[c], ...docs]);
    for (final e in _ctrls.entries) {
      if (data.containsKey(e.key.collection)) e.value.add(_match(e.key));
    }
  }

  List<Rec> _match(RemoteQuery q) => [
        for (final d in _data[q.collection] ?? const <Rec>[])
          if (q.eq.entries.every((e) => (e.key == '__name__' ? d['id'] : d[e.key]) == e.value) &&
              (q.inField == null || q.inValues.contains(q.inField == '__name__' ? d['id'] : d[q.inField!])))
            d
      ];

  @override
  void bind(String schoolId) => bound = schoolId;

  @override
  Stream<List<Rec>> watch(RemoteQuery query) {
    late StreamController<List<Rec>> c;
    c = StreamController<List<Rec>>(onListen: () => Future.microtask(() => c.add(_match(query))), onCancel: () => _ctrls.remove(query));
    _ctrls[query] = c;
    return c.stream;
  }

  @override
  Stream<List<String>> watchSubIds(String collection, String id, String sub) => const Stream.empty();

  @override
  Future<void> set(String collection, String id, Rec data) async => writes.add(RemoteWrite(collection, id, data));

  @override
  Future<void> delete(String collection, String id) async => writes.add(RemoteWrite(collection, id, const {}, delete: true));

  @override
  Future<void> setSub(String collection, String id, String sub, String subId, Rec data) async => joins.add((collection, id, sub, subId));
}
