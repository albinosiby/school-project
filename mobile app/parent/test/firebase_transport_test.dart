import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/core/widgets/phone_call.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/home/repositories/home_repository_interface.dart';
import 'package:parent_app/modules/student/repositories/firebase_student_repository.dart';
import 'package:parent_app/modules/transport/bloc/track_live_bloc.dart';
import 'package:parent_app/modules/transport/models/transport_models.dart';
import 'package:parent_app/modules/transport/repositories/firebase_transport_repository.dart';
import 'package:parent_app/modules/transport/repositories/transport_repository_interface.dart';
import 'package:parent_app/modules/transport/screens/widgets/trip_labels.dart';
import 'package:parent_app/utils/services/firebase/parent_session.dart';
import 'package:parent_app/utils/services/local_storage_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'helpers/pump_app.dart';

const sid = 'sch_1', uid = 'par_1', child = 'stu_101';

/// India wall-clock time on 2026-11-03 as an instant.
DateTime ist(int h, int m, {int day = 3}) => DateTime.utc(2026, 11, day, h, m).subtract(const Duration(hours: 5, minutes: 30));
String isoUtc(DateTime d) => d.toUtc().toIso8601String();

/// `par_transport/{child}` as the function writes it (contract §14.9).
Map<String, dynamic> busDoc({
  String date = '2026-11-03',
  Map<String, dynamic>? pickup,
  Map<String, dynamic>? drop,
  String stopId = 'stp_02',
}) => {
  'studentId': child, 'busId': 'bus_01', 'bus': 'Bus 14', 'regNo': 'DL-01-AB-4092', 'routeName': 'Route 4B', 'model': '42-seater AC',
  'stopId': stopId, 'stop': 'Greater Kailash', 'pickupTime': '06:58', 'dropTime': '15:55',
  'stops': [
    {'id': 'stp_01', 'name': 'Lajpat Nagar', 'pickupTime': '06:45', 'dropTime': '15:40'},
    {'id': 'stp_02', 'name': 'Greater Kailash', 'pickupTime': '06:58', 'dropTime': '15:55'},
    {'id': 'stp_03', 'name': 'Nehru Place', 'pickupTime': '07:10', 'dropTime': '16:05'},
  ],
  'driver': {'name': 'Mr. Rajesh Kumar', 'phone': '+91 98100 44092'},
  'attendant': {'name': 'Ms. Sunita Devi', 'phone': '+91 98100 27731'},
  'today': {
    'date': date,
    'pickup': pickup ?? {'status': 'scheduled', 'startedAt': null, 'endedAt': null, 'mark': null, 'markAt': null},
    'drop': drop ?? {'status': 'scheduled', 'startedAt': null, 'endedAt': null, 'mark': null, 'markAt': null},
  },
  'updatedAt': '2026-11-03T01:00:00.000Z',
};

/// Scrolls [f] to the middle of the list so it can be tapped.
Future<void> reveal(WidgetTester t, Finder f) async {
  if (f.evaluate().isEmpty) {
    await t.scrollUntilVisible(f, 250, scrollable: find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first);
  }
  await Scrollable.ensureVisible(t.element(f.first), alignment: .4);
  await t.pumpAndSettle();
}

void main() {
  group('par_transport mapping (FirebaseTransportRepository.fromDoc)', () {
    test('active pickup trip: stops in doc order, offsets from the first stop, elapsed since startedAt, crew, mark', () {
      final d = busDoc(pickup: {
        'status': 'active', 'startedAt': isoUtc(ist(6, 45)), 'mark': 'boarded', 'markAt': isoUtc(ist(6, 59)),
      });
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(7, 5));
      expect(t.onBus, isTrue);
      expect(t.scheduleBased, isTrue);
      expect(t.kind, TripKind.pickup);
      expect(t.status, TripStatus.active);
      expect(t.stops.map((s) => s.id), ['stp_01', 'stp_02', 'stp_03']);
      expect(t.stops.map((s) => s.offsetMinutes), [0, 13, 25]);
      expect(t.stops.where((s) => s.isChildDrop).single.id, 'stp_02');
      expect(t.elapsedMinutes, 20);
      expect(t.departedAt, ist(6, 45).toLocal());
      expect(t.dropEta, ist(6, 58).toLocal());
      expect(t.phase, TripPhase.droppedOff); // past the child's stop
      expect(t.nextStop!.id, 'stp_03');
      expect(t.minutesToNext, 5);
      expect(t.stateOf(t.stops.first), StopState.passed);
      expect(t.mark, BusMark.boarded);
      expect(t.boardedAt, ist(6, 59).toLocal());
      expect(t.busNo, '14');
      expect(t.route, '4B');
      expect(t.vehicleNo, 'DL-01-AB-4092');
      expect(t.safety, '42-seater AC');
      expect(t.seat, isEmpty);
      expect(t.driver, const BusContact(name: 'Mr. Rajesh Kumar', role: 'Driver', phone: '+91 98100 44092'));
      expect(t.attendant, const BusContact(name: 'Ms. Sunita Devi', role: 'Bus attendant', phone: '+91 98100 27731'));
      expect(t.alerts, defaultBusAlerts);
      expect(t.hasDistance, isFalse);
      expect(t.progressToDrop, 1);
    });

    test('active trip before the child\'s stop: minutes to the stop and progress by schedule', () {
      final d = busDoc(pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 45))});
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(6, 50));
      expect(t.phase, TripPhase.inTransit);
      expect(t.elapsedMinutes, 5);
      expect(t.minutesToDrop, 8);
      expect(t.stopsToDrop, 1);
      expect(t.progressToDrop, closeTo(5 / 13, 1e-9));
      expect(t.mark, isNull);
      expect(t.boardedAt, isNull);
      expect(t.headline, ('8 mins', '  away'));
      expect(t.headlineDetail, startsWith('Pickup at '));
      expect(t.statusPill, 'On the way • Route 4B');
      expect(t.childPill.$1, 'Not marked yet');
    });

    test('elapsed time is measured from the actual start, not the timetable', () {
      final d = busDoc(pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 55))}); // started 10 minutes late
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(7, 0));
      expect(t.elapsedMinutes, 5);
      expect(t.dropEta, ist(7, 8).toLocal());
    });

    test('scheduled trip: elapsed 0, nothing passed, departure at the first stop time', () {
      final t = FirebaseTransportRepository.fromDoc(child, busDoc(), now: ist(6, 30));
      expect(t.kind, TripKind.pickup);
      expect(t.status, TripStatus.scheduled);
      expect(t.phase, TripPhase.scheduled);
      expect(t.elapsedMinutes, 0);
      expect(t.stops.every((s) => !t.isPassed(s)), isTrue);
      expect(t.nextStop!.id, 'stp_01');
      expect(t.stopsToDrop, 2);
      expect(t.progressToDrop, 0);
      expect(t.departedAt, ist(6, 45).toLocal());
      expect(t.speedKmh, 0);
      expect(t.statusPill, 'Scheduled • Route 4B');
      expect(t.headline.$2, '  scheduled');
      expect(t.mapStatus, 'Not started • schedule');
    });

    test('after noon the drop trip is shown, with offsets from the drop times', () {
      final d = busDoc(pickup: {'status': 'completed', 'startedAt': isoUtc(ist(6, 45)), 'endedAt': isoUtc(ist(7, 30))});
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(14, 0));
      expect(t.kind, TripKind.drop);
      expect(t.status, TripStatus.scheduled);
      expect(t.stops.map((s) => s.offsetMinutes), [0, 15, 25]);
      expect(t.departedAt, ist(15, 40).toLocal());
      expect(t.dropEta, ist(15, 55).toLocal());
      expect(t.childStopCaps, "YOUR CHILD'S DROP");
    });

    test('once the morning trip is over the afternoon trip is next, even before noon', () {
      final d = busDoc(pickup: {'status': 'completed', 'startedAt': isoUtc(ist(6, 45))});
      expect(FirebaseTransportRepository.fromDoc(child, d, now: ist(9, 0)).kind, TripKind.drop);
    });

    test('an active trip wins over the time of day', () {
      final d = busDoc(drop: {'status': 'active', 'startedAt': isoUtc(ist(11, 40))});
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(11, 45));
      expect(t.kind, TripKind.drop);
      expect(t.status, TripStatus.active);
    });

    test('completed trip: past the last stop, child dropped', () {
      final d = busDoc(
        pickup: {'status': 'completed'},
        drop: {'status': 'completed', 'startedAt': isoUtc(ist(15, 40)), 'endedAt': isoUtc(ist(16, 10)), 'mark': 'dropped', 'markAt': isoUtc(ist(15, 56))},
      );
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(17, 0));
      expect(t.status, TripStatus.completed);
      expect(t.elapsedMinutes, 26);
      expect(t.phase, TripPhase.completed);
      expect(t.stops.every(t.isPassed), isTrue);
      expect(t.nextStop, isNull);
      expect(t.stopsToDrop, 0);
      expect(t.mark, BusMark.dropped);
      expect(t.markAt, ist(15, 56).toLocal());
      expect(t.childPill.$1, 'Dropped off');
      expect(t.headline.$1, 'Dropped off');
      expect(t.mapStatus, 'Trip ended');
    });

    test('absent mark: not on the bus, no boarding time', () {
      final d = busDoc(pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 45)), 'mark': 'absent', 'markAt': isoUtc(ist(6, 58))});
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(7, 2));
      expect(t.mark, BusMark.absent);
      expect(t.boardedAt, isNull);
      expect(t.childPill.$1, 'Not on the bus');
      expect(t.headline.$1, 'Marked absent');
      expect(t.childLine, contains('Marked absent'));
      expect(t.markVerb, 'Marked absent');
    });

    test('yesterday\'s trip status is ignored: today\'s trip is still scheduled', () {
      final d = busDoc(date: '2026-11-02', pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 45, day: 2)), 'mark': 'boarded'});
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(6, 40));
      expect(t.status, TripStatus.scheduled);
      expect(t.mark, isNull);
    });

    test('missing crew, seat and child stop do not break the trip', () {
      final d = busDoc(stopId: 'stp_xx')
        ..remove('driver')
        ..['attendant'] = {'name': '', 'phone': ''}
        ..['stop'] = '';
      final t = FirebaseTransportRepository.fromDoc(child, d, now: ist(6, 30));
      expect(t.driver.name, 'Driver not assigned');
      expect(t.driver.phone, isEmpty);
      expect(t.attendant.name, 'Bus attendant not assigned');
      expect(t.stops.any((s) => s.isChildDrop), isFalse);
      expect(t.dropStop.id, 'stp_03'); // falls back to the last stop
    });

    test('a bus without a stop list still shows the child\'s own stop; no stop at all is "not on a bus"', () {
      final one = FirebaseTransportRepository.fromDoc(child, busDoc()..['stops'] = <Object>[], now: ist(6, 30));
      expect(one.stops.single.name, 'Greater Kailash');
      expect(one.stops.single.isChildDrop, isTrue);
      final none = FirebaseTransportRepository.fromDoc(
        child,
        busDoc()
          ..['stops'] = <Object>[]
          ..['stopId'] = ''
          ..['stop'] = '',
        now: ist(6, 30),
      );
      expect(none.onBus, isFalse);
    });

    test('helpers: times, prefixes, statuses', () {
      expect(FirebaseTransportRepository.minuteOf('06:58'), 418);
      expect(FirebaseTransportRepository.minuteOf('24:00'), isNull);
      expect(FirebaseTransportRepository.minuteOf(''), isNull);
      expect(FirebaseTransportRepository.stripPrefix('Bus 14', 'bus'), '14');
      expect(FirebaseTransportRepository.stripPrefix('bus #9', 'bus'), '9');
      expect(FirebaseTransportRepository.stripPrefix('Route 4B', 'route'), '4B');
      expect(FirebaseTransportRepository.statusOf('active'), TripStatus.active);
      expect(FirebaseTransportRepository.statusOf(null), isNull);
      expect(FirebaseTransportRepository.markOf('dropped'), BusMark.dropped);
      expect(telUri('+91 98100 44092'), 'tel:+919810044092');
      expect(telUri(''), isNull);
      expect(telUri('+'), isNull);
    });
  });

  group('FirebaseTransportRepository (Firestore)', () {
    late FakeFirebaseFirestore db;
    late ParentSession session;
    late LocalStorageService storage;
    late DateTime now;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      storage = LocalStorageService();
      await storage.init();
      db = FakeFirebaseFirestore();
      session = ParentSession(db: db, auth: MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid)));
      await db.doc('users/$uid').set({'schoolId': sid, 'role': 'parent', 'studentIds': [child], 'classIds': ['cls_10B']});
      await session.load();
      now = ist(6, 50);
    });

    FirebaseTransportRepository repo() => FirebaseTransportRepository(session, storage, clock: () => now);

    test('no par_transport doc: "not on a school bus", not an error', () async {
      final t = await repo().watchTrip(child).first;
      expect(t.onBus, isFalse);
      expect(t, BusTrip.notOnBus(child));
    });

    test('reads the child\'s doc by id and follows changes (trip started by the crew)', () async {
      await db.doc('schools/$sid/par_transport/$child').set(busDoc());
      final seen = <BusTrip>[];
      final sub = repo().watchTrip(child).listen(seen.add);
      await pumpEventQueue();
      expect(seen.last.status, TripStatus.scheduled);
      await db.doc('schools/$sid/par_transport/$child').update({
        'today.pickup': {'status': 'active', 'startedAt': isoUtc(ist(6, 45))},
      });
      await pumpEventQueue();
      expect(seen.last.status, TripStatus.active);
      expect(seen.last.elapsedMinutes, 5);
      await db.doc('schools/$sid/par_transport/$child').delete(); // taken off the bus
      await pumpEventQueue();
      expect(seen.last.onBus, isFalse);
      await sub.cancel();
    });

    test('a poll moves the schedule-based position to the current time', () async {
      await db.doc('schools/$sid/par_transport/$child').set(busDoc(pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 45))}));
      final r = repo();
      final seen = <BusTrip>[];
      final sub = r.watchTrip(child).listen(seen.add);
      await pumpEventQueue();
      expect(seen.last.elapsedMinutes, 5);
      now = ist(6, 53);
      await r.pollPosition(child);
      await pumpEventQueue();
      expect(seen.last.elapsedMinutes, 8);
      final count = seen.length;
      await r.pollPosition('stu_other'); // another child's poll does not touch this stream
      await pumpEventQueue();
      expect(seen.length, count);
      await sub.cancel();
    });

    test('alert toggles are kept per child on the device and pushed through the stream', () async {
      await db.doc('schools/$sid/par_transport/$child').set(busDoc());
      final r = repo();
      final seen = <BusTrip>[];
      final sub = r.watchTrip(child).listen(seen.add);
      await pumpEventQueue();
      expect(seen.last.alertOn(BusAlert.delay), isFalse);
      await r.setAlert(child, BusAlert.delay, true);
      await r.setAlert(child, BusAlert.proximity, false);
      await pumpEventQueue();
      expect(seen.last.alertOn(BusAlert.delay), isTrue);
      expect(seen.last.alertOn(BusAlert.proximity), isFalse);
      await sub.cancel();
      // survives a restart, and other children keep the defaults
      final again = repo();
      expect(again.alertsOf(child)[BusAlert.delay], isTrue);
      expect(again.alertsOf('stu_102'), defaultBusAlerts);
      expect(await again.gateEntryOn(child, DateTime.now()), isNull);
    });

    test('unreadable stored alerts fall back to the defaults', () async {
      await storage.setString('bus_alerts:$uid:$child', 'not json');
      expect(repo().alertsOf(child), defaultBusAlerts);
    });

    test('TrackLiveBloc on Firestore: loading -> loaded, toggles alerts, polls', () async {
      TrackLiveBloc.pollInterval = null;
      addTearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));
      await db.doc('schools/$sid/par_transport/$child').set(busDoc(pickup: {'status': 'active', 'startedAt': isoUtc(ist(6, 45))}));
      final bloc = TrackLiveBloc(repo());
      expect(bloc.state.status, LoadStatus.loading);
      bloc.add(const LoadChildData(child));
      final loaded = await bloc.stream.firstWhere((s) => s.status == LoadStatus.loaded);
      expect(loaded.data!.busNo, '14');
      bloc.add(const ToggleBusAlert(BusAlert.delay, true));
      await bloc.stream.firstWhere((s) => s.data!.alertOn(BusAlert.delay));
      now = ist(6, 55);
      bloc.add(const PollBusPosition());
      final moved = await bloc.stream.firstWhere((s) => s.data!.elapsedMinutes == 10);
      expect(moved.data!.minutesToDrop, 3);
      await bloc.close();
    });

    test('TrackLiveBloc: a child without a bus loads as the empty trip', () async {
      TrackLiveBloc.pollInterval = null;
      addTearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));
      final bloc = TrackLiveBloc(repo())..add(const LoadChildData(child));
      final s = await bloc.stream.firstWhere((s) => s.status != LoadStatus.loading);
      expect(s.status, LoadStatus.loaded);
      expect(s.data!.onBus, isFalse);
      await bloc.close();
    });
  });

  group('Student profile TransportInfo from par_transport', () {
    test('bus, route, stop, times, driver and attendant', () {
      final t = FirebaseStudentRepository.transportOf(busDoc());
      expect(t.onBus, isTrue);
      expect(t.busNo, 'Bus #14');
      expect(t.route, 'Route 4B');
      expect(t.pickup, '06:58 AM');
      expect(t.drop, '03:55 PM');
      expect(t.stopName, 'Greater Kailash');
      expect(t.stopAddress, isEmpty);
      expect(t.driver, 'Mr. Rajesh Kumar');
      expect(t.driverPhone, '+91 98100 44092');
      expect(t.attendant, 'Ms. Sunita Devi');
      expect(t.supervisorPhone, '+91 98100 27731');
      expect(t.scheduleBased, isTrue);
    });

    test('no doc: not on a school bus', () {
      final t = FirebaseStudentRepository.transportOf(null);
      expect(t.onBus, isFalse);
    });

    test('watchProfile fills transport from the projection and updates when it changes', () async {
      final db = FakeFirebaseFirestore();
      final session = ParentSession(db: db, auth: MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid)));
      await db.doc('users/$uid').set({'schoolId': sid, 'role': 'parent', 'studentIds': [child], 'classIds': ['cls_10B']});
      await db.doc('schools/$sid/students/$child').set({'name': 'Aarav Sharma', 'grade': '10', 'section': 'B', 'classId': 'cls_10B'});
      await session.load();
      final repo = FirebaseStudentRepository(session, FakeLauncher());
      final seen = <String>[];
      final sub = repo.watchProfile(child).listen((p) => seen.add(p.transport.busNo));
      await pumpEventQueue();
      expect(seen.last, isEmpty);
      await db.doc('schools/$sid/par_transport/$child').set(busDoc());
      await pumpEventQueue();
      expect(seen.last, 'Bus #14');
      await sub.cancel();
    });
  });

  group('Track Live and Home on the Firestore projection', () {
    late FakeFirebaseFirestore db;

    Future<void> useFirestoreTransport(WidgetTester t, {Map<String, dynamic>? doc}) async {
      await t.runAsync(() async {
        db = FakeFirebaseFirestore();
        final session = ParentSession(db: db, auth: MockFirebaseAuth(signedIn: true, mockUser: MockUser(uid: uid)));
        await db.doc('users/$uid').set({'schoolId': sid, 'role': 'parent', 'studentIds': [DemoData.aarav.id]});
        if (doc != null) await db.doc('schools/$sid/par_transport/${DemoData.aarav.id}').set(doc);
        await session.load();
        getIt.unregister<ITransportRepository>();
        getIt.registerSingleton<ITransportRepository>(FirebaseTransportRepository(session, getIt<LocalStorageService>()));
      });
    }

    String todayIst() => isoDay(DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30)));

    testWidgets('schedule-based caption, crew calls open the dialer with tel:', (t) async {
      TrackLiveBloc.pollInterval = null;
      addTearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));
      final launcher = await setUpTestApp(signedIn: true);
      await useFirestoreTransport(t, doc: busDoc(date: todayIst()));
      await pumpApp(t, location: RoutePaths.trackLive);
      await t.pump(const Duration(milliseconds: 50));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('track-schedule-caption')), findsOneWidget);
      expect(find.text(scheduleCaption), findsOneWidget);
      expect(find.text('Bus #14'), findsOneWidget);
      expect(find.text('Schedule-based'), findsOneWidget);
      expect(find.textContaining('km/h'), findsNothing); // no simulated GPS speed
      expect(find.text('3 Key Stops'), findsOneWidget);

      final callDriver = find.byTooltip('Call Mr. Rajesh Kumar');
      await reveal(t, callDriver);
      await t.tap(callDriver);
      await t.pumpAndSettle();
      expect(find.text('Driver • +91 98100 44092'), findsOneWidget);
      await t.tap(find.text('Call now'));
      await t.pumpAndSettle();
      expect(launcher.opened, ['tel:+919810044092']);
      expect(find.textContaining('Calling Mr. Rajesh Kumar'), findsOneWidget);

      await t.tap(find.byTooltip('Call Ms. Sunita Devi'));
      await t.pumpAndSettle();
      await t.tap(find.text('Call now'));
      await t.pumpAndSettle();
      expect(launcher.opened.last, 'tel:+919810027731');
    });

    testWidgets('the dialer failing shows the number to call instead', (t) async {
      TrackLiveBloc.pollInterval = null;
      addTearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));
      final launcher = await setUpTestApp(signedIn: true, launcherSucceeds: false);
      await useFirestoreTransport(t, doc: busDoc(date: todayIst()));
      await pumpApp(t, location: RoutePaths.trackLive);
      await t.pump(const Duration(milliseconds: 50));
      await t.pumpAndSettle();
      final callDriver = find.byTooltip('Call Mr. Rajesh Kumar');
      await reveal(t, callDriver);
      await t.tap(callDriver);
      await t.pumpAndSettle();
      await t.tap(find.text('Call now'));
      await t.pumpAndSettle();
      expect(launcher.opened, hasLength(1));
      expect(find.text('Call Mr. Rajesh Kumar on +91 98100 44092'), findsOneWidget);
    });

    testWidgets('a child who is not on a school bus sees an empty state, and Home shows no bus card', (t) async {
      TrackLiveBloc.pollInterval = null;
      addTearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));
      await setUpTestApp(signedIn: true);
      await useFirestoreTransport(t);
      await pumpApp(t, location: RoutePaths.trackLive);
      await t.pump(const Duration(milliseconds: 50));
      await t.pumpAndSettle();
      expect(find.text('Not on a school bus'), findsOneWidget);
      expect(find.textContaining('Ask the school office'), findsOneWidget);
      expect(find.text('Call now'), findsNothing);

      final home = await t.runAsync(() => getIt<IHomeRepository>().watchToday(DemoData.aarav.id).first);
      expect(home!.bus, isNull);
    });
  });
}
