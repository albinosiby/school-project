import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/transport/bloc/track_live_bloc.dart';
import 'package:parent_app/modules/transport/models/transport_models.dart';
import 'package:parent_app/modules/transport/repositories/mock_transport_repository.dart';
import 'package:parent_app/modules/transport/repositories/transport_demo_data.dart';
import 'package:parent_app/modules/transport/repositories/transport_repository_interface.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'helpers/pump_app.dart';

BusTrip _trip(double elapsed) => BusTrip(
  childId: 'c',
  busNo: '14',
  route: '4B',
  vehicleNo: 'X',
  safety: 'Y',
  driver: TransportDemoData.driver,
  attendant: TransportDemoData.attendant,
  departedAt: DateTime(2026, 10, 27, 15, 15),
  elapsedMinutes: elapsed,
  stops: TransportDemoData.stops,
  seat: '#1',
  boardedAt: DateTime(2026, 10, 27, 15, 12),
  alerts: TransportDemoData.defaultAlerts,
);

Future<void> _settle() => Future<void>.delayed(const Duration(milliseconds: 5));

void main() {
  group('BusTrip (derived live values)', () {
    test('in transit: ETA, next stop, stops and distance to the drop', () {
      final t = _trip(30);
      expect(t.phase, TripPhase.inTransit);
      expect(t.minutesToDrop, 12);
      expect(t.dropEta, DateTime(2026, 10, 27, 15, 57));
      expect(t.nextStop?.name, 'Sector 12 Market');
      expect(t.minutesToNext, 4);
      expect(t.stopsToDrop, 2);
      expect(t.kmToDrop, closeTo(2.3, .2));
      expect(t.progressToDrop, inExclusiveRange(0, 1));
      expect(t.stateOf(t.origin), StopState.passed);
      expect(t.stateOf(t.dropStop), StopState.upcoming);
    });

    test('after the drop and at the terminus', () {
      expect(_trip(42).phase, TripPhase.droppedOff);
      expect(_trip(42).stopsToDrop, 0);
      expect(_trip(42).kmToDrop, 0);
      final end = _trip(55);
      expect(end.phase, TripPhase.completed);
      expect(end.nextStop, isNull);
      expect(end.speedKmh, 0);
      expect(end.mapPosition, (x: end.terminus.mapX, y: end.terminus.mapY));
    });
  });

  group('MockTransportRepository', () {
    setUp(() async {
      await setUpTestApp(signedIn: true);
      TrackLiveBloc.pollInterval = null;
    });
    tearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));

    test('cache-first: second watch shows the cached trip first', () async {
      final cache = CacheService();
      final repo = MockTransportRepository(cache);
      final first = await repo.watchTrip(DemoData.aarav.id).first;
      expect(cache.read<BusTrip>('transport:${DemoData.aarav.id}'), first);
      repo.advance(2);
      final again = await repo.watchTrip(DemoData.aarav.id).first;
      expect(again, first); // cached value comes first
    });

    test('the live feed advances the bus and updates the ETA', () async {
      final repo = MockTransportRepository(CacheService());
      final seen = <BusTrip>[];
      final sub = repo.watchTrip(DemoData.aarav.id).listen(seen.add);
      await _settle();
      final eta = seen.last.minutesToDrop;
      repo.advance(4);
      await _settle();
      expect(seen.last.minutesToDrop, eta - 4);
      repo.advance(100); // clamps at the terminus
      await _settle();
      expect(seen.last.phase, TripPhase.completed);
      // cacheFirst's async* loop never completes a cancel after a refresh, so don't await it.
      unawaited(sub.cancel());
    });

    test('TrackLiveBloc polls the GPS while open and stops on close', () async {
      TrackLiveBloc.pollInterval = const Duration(milliseconds: 5);
      final repo = getIt<ITransportRepository>() as MockTransportRepository;
      final start = repo.elapsedMinutes;
      final bloc = getIt<TrackLiveBloc>()
        ..add(LoadChildData(DemoData.aarav.id));
      final moved = await bloc.stream.firstWhere(
        (s) => (s.data?.elapsedMinutes ?? start) > start,
      );
      expect(moved.data!.minutesToDrop, lessThanOrEqualTo(12));
      await bloc.close();
      final after = repo.elapsedMinutes;
      await _settle();
      await _settle();
      expect(repo.elapsedMinutes, after); // polling stopped with the BLoC
    });

    test('TrackLiveBloc toggles alerts through the repository', () async {
      final bloc = getIt<TrackLiveBloc>()
        ..add(LoadChildData(DemoData.aarav.id));
      final loaded = await bloc.stream.firstWhere(
        (s) => s.status == LoadStatus.loaded,
      );
      expect(loaded.data!.alertOn(BusAlert.delay), isFalse);
      bloc.add(const ToggleBusAlert(BusAlert.delay, true));
      final s = await bloc.stream.firstWhere(
        (s) => s.data?.alertOn(BusAlert.delay) ?? false,
      );
      expect(s.data!.alertOn(BusAlert.proximity), isTrue);
      // Alerts are per child.
      final other = await getIt<ITransportRepository>()
          .watchTrip(DemoData.ananya.id)
          .first;
      expect(other.alertOn(BusAlert.delay), isFalse);
      await bloc.close();
    });
  });
}
