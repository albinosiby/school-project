import 'package:driver_app/di/demo_data.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/modules/attendance/models/attendance_models.dart';
import 'package:driver_app/modules/trips/models/trip_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/pump_app.dart';

void main() {
  group('auth', () {
    testWidgets('signed-out user lands on welcome, wrong password is refused, demo driver signs in', (tester) async {
      await setUpTestApp();
      await pumpApp(tester);
      expect(find.text('Edvio Driver'), findsWidgets);
      await tester.tap(find.text('Get Started'));
      await settle(tester);
      expect(find.text('Driver / Bus Staff Sign In'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).at(0), DemoStore.driverEmail);
      await tester.enterText(find.byType(TextFormField).at(1), 'wrongpass');
      await tester.tap(find.text('Sign In'));
      await settle(tester);
      expect(find.text('Incorrect email or password.'), findsOneWidget);
      await tester.tap(find.text('Rajesh Kumar'));
      await settle(tester);
      expect(find.textContaining('Welcome, Rajesh'), findsOneWidget);
      expect(find.text('Bus 14'), findsWidgets);
    });

    testWidgets('a restored session opens Home and sign out returns to welcome', (tester) async {
      await setUpTestApp(signedInAs: 'crw_002');
      await pumpApp(tester);
      expect(find.textContaining('Welcome, Sunita'), findsOneWidget);
      await tester.tap(find.text('Profile').last);
      await settle(tester);
      expect(find.text('Bus Attendant · Bus 14'), findsOneWidget);
      await tester.drag(find.byType(ListView).last, const Offset(0, -900));
      await settle(tester);
      await tester.tap(find.text('Sign out'));
      await settle(tester);
      await tester.tap(find.text('Sign out').last);
      await settle(tester);
      expect(find.text('Get Started'), findsOneWidget);
    });
  });

  group('driver trip journey', () {
    testWidgets('checklist blocks the start, then start, mark pupils, end trip', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester);
      final store = getIt<DemoStore>();
      final tripId = Trip.idFor(store.today, 'bus_01', TripKind.pickup);
      expect(store.trips[tripId]!.isScheduled, isTrue);

      await tester.tap(find.text('Start pre-trip checklist'));
      await settle(tester);
      expect(find.text('Morning Pickup'), findsOneWidget);
      await tester.tap(find.textContaining('Complete pre-trip checklist'));
      await settle(tester);
      expect(find.text('Pre-trip checklist'), findsOneWidget);
      for (var i = 0; i < Checklist.items.length; i++) {
        await tester.tap(find.byType(CheckboxListTile).at(i));
        await tester.pump();
      }
      expect(find.textContaining('All 6 checks passed'), findsOneWidget);
      await tester.tap(find.text('Save & mark passed'));
      await settle(tester);
      expect(store.trips[tripId]!.checklist.complete, isTrue);

      // back on the trip: start it
      await tester.tap(find.text('Start pickup trip'));
      await settle(tester);
      await tester.tap(find.text('Start trip'));
      await settle(tester);
      expect(store.trips[tripId]!.isActive, isTrue);
      expect(find.text('Live'), findsWidgets);

      // mark the first pupil boarded, the second absent
      await tapVisible(tester, find.byKey(const ValueKey('mark-Boarded-Aarav Sharma')));
      await settle(tester);
      await tapVisible(tester, find.byKey(const ValueKey('mark-Absent-Ananya Patel')));
      await settle(tester);
      final att = store.attendance[tripId]!;
      expect(att.of('stu_101')!.status, MarkStatus.boarded);
      expect(att.of('stu_102')!.status, MarkStatus.absent);
      expect(att.of('stu_101')!.by, 'crw_001');
      expect(store.trips[tripId]!.boarded, 1);
      expect(store.trips[tripId]!.absent, 1);

      // end the trip: boarded pupils arrive at school
      await tapVisible(tester, find.text('End trip'));
      await settle(tester);
      await tester.tap(find.text('End trip').last);
      await settle(tester);
      final done = store.trips[tripId]!;
      expect(done.isCompleted, isTrue);
      expect(store.attendance[tripId]!.of('stu_101')!.status, MarkStatus.dropped);
      expect(done.dropped, 1);
      expect(done.absent, 1);
    });

    testWidgets('an attendant marks a pupil on the live trip and can undo', (tester) async {
      final store = DemoStore();
      final tripId = Trip.idFor(store.today, 'bus_01', TripKind.pickup);
      store.trips[tripId] = store.trips[tripId]!.copyWith(status: TripStatus.active, startedAt: DateTime.now(), checklist: const Checklist(brakes: true, lights: true, tyres: true, fuel: true, firstAid: true, cleanliness: true));
      await setUpTestApp(signedInAs: 'crw_002', store: store);
      await pumpApp(tester);
      await tester.tap(find.text('Open live trip'));
      await settle(tester);
      await tapVisible(tester, find.byKey(const ValueKey('mark-Boarded-Aarav Sharma')));
      await settle(tester);
      expect(store.attendance[tripId]!.of('stu_101')!.byName, 'Sunita Devi');
      await tapVisible(tester, find.byKey(const ValueKey('mark-Undo-Aarav Sharma')));
      await settle(tester);
      expect(store.attendance[tripId]!.of('stu_101'), isNull);
    });
  });

  group('students', () {
    testWidgets('roster shows guardian phone and Call opens the dialer; stop filter narrows the list', (tester) async {
      final launcher = await setUpTestApp(signedInAs: 'crw_002');
      await pumpApp(tester, location: '/students');
      expect(find.text('14 students on Bus 14'), findsOneWidget);
      expect(find.textContaining('+91 98100 00001'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Call Mr. Rahul Sharma'));
      await settle(tester);
      expect(launcher.opened, ['tel:+919810000001']);
      await tester.enterText(find.byType(TextField).first, 'DLF');
      await settle(tester);
      expect(find.text('Rohan Verma'), findsOneWidget);
      expect(find.text('Aarav Sharma'), findsNothing);
    });

    testWidgets('tapping a pupil opens the card with the medical note and recent attendance', (tester) async {
      await setUpTestApp(signedInAs: 'crw_002');
      await pumpApp(tester, location: '/students');
      await tester.tap(find.text('Aarav Sharma'));
      await settle(tester);
      expect(find.text('Peanut allergy (EpiPen in front pouch)'), findsOneWidget);
      expect(find.text('RECENT BUS ATTENDANCE'), findsOneWidget);
      expect(find.text('Dropped'), findsWidgets);
    });

    testWidgets('a crew member without a bus sees the empty state', (tester) async {
      final store = DemoStore();
      store.crew['crw_002'] = store.crew['crw_002']!.copyWith(busId: '', bus: '');
      await setUpTestApp(signedInAs: 'crw_002', store: store);
      await pumpApp(tester, location: '/students');
      expect(find.text('No bus allotted yet'), findsOneWidget);
    });
  });

  group('crew attendance and leave', () {
    testWidgets('check in and out from Home, then the day shows on My attendance', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester);
      expect(find.text('Not checked in'), findsOneWidget);
      await tester.tap(find.text('Check in'));
      await settle(tester);
      expect(find.textContaining('On duty since'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5)); // the "Checked in" snack bar covers the card
      await settle(tester);
      await tester.tap(find.text('Check out'));
      await settle(tester);
      expect(find.text('Shift complete'), findsOneWidget);
      final store = getIt<DemoStore>();
      final day = store.crewDays['${store.today}_crw_001']!;
      expect(day.punchedIn && day.punchedOut, isTrue);
      await tapVisible(tester, find.text('My attendance'));
      await settle(tester);
      expect(find.text('Shift complete'), findsOneWidget);
      expect(find.text('Present'), findsWidgets);
    });

    testWidgets('apply for leave and withdraw it', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester, location: '/profile/leave');
      expect(find.text('Approved'), findsOneWidget);
      await tester.tap(find.text('Apply'));
      await settle(tester);
      await tester.tap(find.text('Sick'));
      await tester.tap(find.text('Submit request'));
      await settle(tester);
      expect(find.text('Give a short reason for the leave.'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), 'Fever and cold');
      await tester.tap(find.text('Submit request'));
      await settle(tester);
      expect(find.text('Pending'), findsOneWidget);
      final store = getIt<DemoStore>();
      expect(store.leaves.values.where((l) => l.crewId == 'crw_001' && l.isPending).single.type, 'Sick');
      await tester.tap(find.text('Withdraw'));
      await settle(tester);
      await tester.tap(find.text('Withdraw').last);
      await settle(tester);
      expect(find.text('Pending'), findsNothing);
    });
  });

  group('notices and profile', () {
    testWidgets('notices show only crew-visible ones and open the detail', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester, location: '/notices');
      expect(find.textContaining('Fog timings'), findsOneWidget);
      expect(find.text('Exam marks window'), findsNothing);
      await tester.tap(find.textContaining('Fog timings'));
      await settle(tester);
      expect(find.textContaining('every route starts 20 minutes later'), findsOneWidget);
    });

    testWidgets('edit profile saves phone and emergency contact', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester, location: '/profile/edit');
      await tester.enterText(find.byType(TextFormField).at(0), '+91 90000 00000');
      await tester.enterText(find.byType(TextFormField).at(2), 'Asha Kumar');
      await tester.tap(find.text('Save changes'));
      await settle(tester);
      final me = getIt<DemoStore>().crew['crw_001']!;
      expect(me.phone, '+91 90000 00000');
      expect(me.emergencyName, 'Asha Kumar');
    });

    testWidgets('trip history lists completed trips with the kind filter', (tester) async {
      await setUpTestApp(signedInAs: 'crw_001');
      await pumpApp(tester, location: '/trips/history');
      expect(find.text('Morning Pickup'), findsWidgets);
      await tester.tap(find.text('Drop'));
      await settle(tester);
      expect(find.text('Morning Pickup'), findsNothing);
      expect(find.text('Afternoon Drop'), findsWidgets);
    });
  });
}
