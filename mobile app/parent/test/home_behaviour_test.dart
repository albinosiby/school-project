import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/behaviour/bloc/behaviour_bloc.dart';
import 'package:parent_app/modules/behaviour/models/behaviour_models.dart';
import 'package:parent_app/modules/behaviour/repositories/behaviour_demo_data.dart';
import 'package:parent_app/modules/behaviour/repositories/mock_behaviour_repository.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'helpers/pump_app.dart';

void main() {
  setUp(() => setUpTestApp(signedIn: true));

  test('report numbers derive from the entries', () {
    final r = BehaviourDemoData.report(DemoData.aarav.id);
    expect(r.count(ConductFilter.all), r.entries.length);
    expect(
      r.count(ConductFilter.praise) + r.count(ConductFilter.guidance),
      r.entries.length,
    );
    expect(r.praiseStars, r.entries.where((e) => e.isPraise).length);
    expect(r.activeFlags, 1); // one open guidance note
    expect(r.meritsLogged, r.entries.fold<int>(0, (s, e) => s + e.merits));
    expect(r.positiveIndex, inInclusiveRange(90, 99));
    expect(r.count(ConductFilter.commendations), 2);
    expect(BehaviourDemoData.report(DemoData.ananya.id).activeFlags, 0);
  });

  test('repository is cache-first and newest first', () async {
    final cache = CacheService();
    final repo = MockBehaviourRepository(cache);
    final r = await repo.watchReport(DemoData.aarav.id).first;
    expect(cache.contains('behaviour:${DemoData.aarav.id}'), isTrue);
    for (var i = 1; i < r.entries.length; i++) {
      expect(r.entries[i - 1].at.isAfter(r.entries[i].at), isTrue);
    }
  });

  test('BehaviourBloc acknowledges an incident with a note', () async {
    final bloc = getIt<BehaviourBloc>()..add(LoadChildData(DemoData.aarav.id));
    final loaded = await bloc.stream.firstWhere(
      (s) => s.status == LoadStatus.loaded,
    );
    final open = loaded.data!.entries.firstWhere((e) => e.needsAck);
    bloc.add(AcknowledgeConduct(open.id, note: ' We will plan better. '));
    final s = await bloc.stream.firstWhere((s) => s.data!.activeFlags == 0);
    final done = s.data!.entries.firstWhere((e) => e.id == open.id);
    expect(done.acknowledged, isTrue);
    expect(done.parentNote, 'We will plan better.');
    expect(done.note, open.note); // the teacher's note is kept
    await bloc.close();
  });
}
