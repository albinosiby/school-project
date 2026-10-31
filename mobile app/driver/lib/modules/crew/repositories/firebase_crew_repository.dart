import 'dart:async';
import '../../../utils/services/firebase/crew_session.dart';
import '../models/crew_models.dart';
import 'crew_repository_interface.dart';

/// `tr_crew/{me}`, `tr_buses/{me.busId}` and the other crew member of that bus (contract 14.1, 14.2).
class FirebaseCrewRepository implements ICrewRepository {
  FirebaseCrewRepository(this._session);
  final CrewSession _session;

  @override
  Stream<CrewContext> watchContext() => _session.whenReady(() => _session.watchMe().asyncExpand((me) {
        final busId = me.busId ?? '';
        final school = _session.col('school').doc('school').snapshots().map((s) => '${s.data()?['name'] ?? ''}');
        if (busId.isEmpty) return school.map((name) => CrewContext(me: me, schoolName: name));
        final bus = _session.col('tr_buses').doc(busId).snapshots().map((s) => s.data() == null ? null : Bus.fromJson(s.data()!, id: s.id));
        final partner = _session.col('tr_crew').where('busId', isEqualTo: busId).snapshots().map((q) {
          for (final d in q.docs) {
            if (d.id != me.id) return CrewMember.fromJson(d.data(), id: d.id);
          }
          return null;
        });
        return _combine3(bus, partner, school).map((v) => CrewContext(me: me, bus: v.$1, partner: v.$2, schoolName: v.$3));
      }));

  @override
  Future<void> updateProfile({String? phone, String? address, String? emergencyName, String? emergencyPhone}) =>
      _session.crewDoc.update({
        'phone': ?phone,
        'address': ?address,
        'emergencyName': ?emergencyName,
        'emergencyPhone': ?emergencyPhone,
        'updatedAt': nowUtc(),
        'updatedBy': _session.uid,
      });
}

/// Latest value of three streams, emitted whenever one changes (after each has emitted once).
Stream<(A, B, C)> _combine3<A, B, C>(Stream<A> a, Stream<B> b, Stream<C> c) {
  late StreamController<(A, B, C)> out;
  final subs = <StreamSubscription<void>>[];
  A? va;
  B? vb;
  C? vc;
  var sa = false, sb = false, sc = false;
  void push() {
    if (sa && sb && sc) out.add((va as A, vb as B, vc as C));
  }
  out = StreamController(
    onListen: () {
      subs.add(a.listen((v) { va = v; sa = true; push(); }, onError: out.addError));
      subs.add(b.listen((v) { vb = v; sb = true; push(); }, onError: out.addError));
      subs.add(c.listen((v) { vc = v; sc = true; push(); }, onError: out.addError));
    },
    onCancel: () async {
      for (final s in subs) {
        await s.cancel();
      }
    },
  );
  return out.stream;
}
