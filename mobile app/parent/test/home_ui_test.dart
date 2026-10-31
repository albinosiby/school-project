import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/modules/transport/bloc/track_live_bloc.dart';
import 'helpers/pump_app.dart';

final _weekday = DateTime.now().weekday <= DateTime.friday;

GoRouter _router(WidgetTester t) =>
    GoRouter.of(t.element(find.byType(Scaffold, skipOffstage: false).first));

/// Location of the top-most route (pushed routes included).
String _loc(WidgetTester t) => _router(t).state.uri.toString();

Future<void> _go(WidgetTester t, String path) async {
  _router(t).go(path);
  await t.pumpAndSettle();
}

final _vertical = find.byWidgetPredicate(
  (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
);

/// Scrolls [f] into the middle of the screen (clear of the header and the dock).
Future<void> _reveal(WidgetTester t, Finder f) async {
  if (f.hitTestable().evaluate().isEmpty && f.evaluate().isEmpty) {
    await t.scrollUntilVisible(f, 250, scrollable: _vertical.first);
  }
  await Scrollable.ensureVisible(t.element(f.first), alignment: .4);
  await t.pumpAndSettle();
}

/// Taps [f] (scrolling to it) and checks the router moved to [path].
Future<void> _tapGoes(
  WidgetTester t,
  Finder f,
  bool Function(String loc) isAt, {
  String back = RoutePaths.home,
}) async {
  await _reveal(t, f);
  await t.tap(f);
  await t.pumpAndSettle();
  expect(isAt(_loc(t)), isTrue, reason: 'went to ${_loc(t)}');
  await _go(t, back);
}

Future<void> _press(WidgetTester t, Finder f) async {
  await _reveal(t, f);
  await t.tap(f.first);
  await t.pumpAndSettle();
}

/// Checks a snackbar with [text] shows (after any previous one hides), then lets it go.
Future<void> _snack(WidgetTester t, String text) async {
  await t.pump(const Duration(milliseconds: 800));
  expect(find.textContaining(text), findsOneWidget);
  await t.pump(const Duration(seconds: 3));
  await t.pump(const Duration(seconds: 3));
  await t.pumpAndSettle();
}

void main() {
  setUp(() async {
    await setUpTestApp(signedIn: true);
    TrackLiveBloc.pollInterval = null; // no GPS polling unless a test asks
  });
  tearDown(() => TrackLiveBloc.pollInterval = const Duration(seconds: 4));

  group('Home', () {
    testWidgets('child card, bus and attendance cards', (t) async {
      await pumpApp(t, location: RoutePaths.home);
      expect(find.text('Aarav Sharma'), findsWidgets);
      expect(find.text('2 Children'), findsOneWidget);
      expect(find.text('Secured RFID'), findsOneWidget);
      expect(find.text("TODAY'S ATTENDANCE"), findsOneWidget);
      expect(find.byKey(const Key('home-term-average')), findsOneWidget);
      if (_weekday) {
        expect(find.text('BUS #14 (ROUTE 4B) • IN TRANSIT'), findsOneWidget);
        expect(find.text('ETA 12 mins'), findsOneWidget);
        expect(find.text('2 stops remaining'), findsOneWidget);
        expect(find.text('Present Today'), findsOneWidget);
        expect(find.text('Gate entry verified via RFID Badge'), findsOneWidget);
        // Track Live button and the card itself open Track Live.
        await _tapGoes(
          t,
          find.widgetWithText(AppButton, 'Track Live'),
          (l) => l == RoutePaths.trackLive,
        );
        await _tapGoes(
          t,
          find.text('BUS #14 (ROUTE 4B) • IN TRANSIT'),
          (l) => l == RoutePaths.trackLive,
        );
      }
      await _tapGoes(
        t,
        find.text("TODAY'S ATTENDANCE"),
        (l) => l == RoutePaths.academicsSection('attendance'),
      );
    });

    testWidgets('switching child from the pill and the name', (t) async {
      await pumpApp(t, location: RoutePaths.home);
      await t.tap(find.byKey(const Key('home-children-pill')));
      await t.pumpAndSettle();
      expect(find.text('Switch child'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('switch-stu_ananya')));
      await t.pumpAndSettle();
      expect(find.text('Ananya Sharma'), findsWidgets);
      // weekends show "No School Today" instead
      expect(find.textContaining(RegExp('Not Marked Yet|No School Today')), findsOneWidget);
      expect(find.textContaining(RegExp('No RFID gate entry yet|No gate entry on holidays')), findsOneWidget);
      await t.tap(find.byKey(const Key('home-child-trigger')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('switch-stu_aarav')));
      await t.pumpAndSettle();
      expect(find.text('Roll #14 • CBSE Campus'), findsOneWidget);
    });

    testWidgets('quick actions open the right screens', (t) async {
      await pumpApp(t, location: RoutePaths.home);
      await _tapGoes(t, find.text('Pay Fees'), (l) => l == RoutePaths.fees);
      await _tapGoes(
        t,
        find.text('Apply\nLeave'),
        (l) => l == RoutePaths.leaveApply,
      );
      await _tapGoes(
        t,
        find.text('Teacher\nChat'),
        (l) => l == RoutePaths.messages,
      );
      await _tapGoes(
        t,
        find.text('Behaviour'),
        (l) => l == RoutePaths.behaviour,
      );
    });

    testWidgets('below the fold: links, tasks, notices and support', (t) async {
      await pumpApp(t, location: RoutePaths.home);
      await _tapGoes(
        t,
        find.text('Timetable'),
        (l) => l == RoutePaths.academicsSection('timetable'),
      );
      if (_weekday) {
        await _tapGoes(
          t,
          find.text('All').hitTestable(),
          (l) => l == RoutePaths.liveClasses,
        );
      }
      await _tapGoes(
        t,
        find.text('All Tasks'),
        (l) => l == RoutePaths.academicsSection('homework'),
      );
      final task = find.byType(AppElevatedCard).evaluate().isEmpty
          ? null
          : find.textContaining('Due ');
      if (task != null && task.evaluate().isNotEmpty) {
        await _tapGoes(
          t,
          task.first,
          (l) => l.startsWith('/academics/homework/'),
        );
      }
      await _tapGoes(t, find.text('PTM Schedule'), (l) => l == RoutePaths.ptm);
      await _tapGoes(
        t,
        find.textContaining('From: ').first,
        (l) => l.startsWith('/notifications/'),
      );
      await _reveal(t, find.text('Support'));
      await t.tap(find.text('Support'));
      await t.pumpAndSettle();
      await t.tap(find.text('Accounts Office'));
      await t.pumpAndSettle();
      await _snack(t, 'Calling Accounts Office');
      await t.tap(find.text('Support'));
      await t.pumpAndSettle();
      await t.tap(find.text('Portal Helpdesk'));
      await t.pumpAndSettle();
      await _snack(t, 'Email to Portal Helpdesk');
    });
  });

  group('Track Live', () {
    testWidgets('ETA, milestones, map controls, calls and alerts', (t) async {
      await pumpApp(t, location: RoutePaths.trackLive);
      expect(find.text('TRACK LIVE'), findsOneWidget);
      expect(find.textContaining('12 mins'), findsWidgets);
      expect(find.text('Onboard Safe'), findsOneWidget);
      expect(find.textContaining('Drop ETA'), findsOneWidget);
      await t.tap(find.byTooltip('Re-centre on bus'));
      await t.pump();
      await _snack(t, 'Centred on Bus #14');
      await t.tap(find.byTooltip('Show satellite map'));
      await t.pump();
      await _snack(t, 'Satellite view');
      expect(find.byTooltip('Show street map'), findsOneWidget);

      await _reveal(t, find.text('Route Milestones'));
      expect(find.text('6 Key Stops'), findsOneWidget);
      expect(find.text('Next stop • 4 mins away'), findsOneWidget);
      expect(find.text("YOUR CHILD'S DROP"), findsOneWidget);

      final callDriver = find.byTooltip('Call Mr. Rajesh Kumar');
      await _reveal(t, callDriver);
      await t.tap(callDriver);
      await t.pumpAndSettle();
      await t.tap(find.text('Call now'));
      await t.pumpAndSettle();
      await _snack(t, 'Calling Mr. Rajesh Kumar');
      await t.tap(find.byTooltip('Call Ms. Sunita Devi'));
      await t.pumpAndSettle();
      await t.tap(find.text('Cancel'));
      await t.pumpAndSettle();
      expect(find.textContaining('Calling Ms. Sunita'), findsNothing);

      final delay = find.byKey(const ValueKey('bus-alert-delay'));
      await _reveal(t, delay);
      Switch sw() => t.widget<Switch>(
        find.descendant(of: delay, matching: find.byType(Switch)),
      );
      expect(sw().value, isFalse);
      await t.tap(delay);
      await t.pumpAndSettle();
      expect(sw().value, isTrue);
      await _snack(t, 'Delay alerts on');
    });

    testWidgets('the live feed moves the bus and updates the ETA', (t) async {
      TrackLiveBloc.pollInterval = const Duration(seconds: 4);
      await pumpApp(t, location: RoutePaths.trackLive);
      expect(find.text('12 mins'), findsNothing); // rich text
      expect(find.textContaining('12 mins'), findsWidgets);
      for (var i = 0; i < 4; i++) {
        await t.pump(const Duration(seconds: 4));
      }
      await t.pump();
      expect(find.textContaining('10 mins'), findsWidgets);
      // Leave the screen so the feed stops with its last watcher.
      await _go(t, RoutePaths.more);
    });

    testWidgets('header: bell, avatar and back', (t) async {
      await pumpApp(t, location: RoutePaths.trackLive);
      await t.tap(find.byTooltip('Notifications'));
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.notifications);
      await _go(t, RoutePaths.trackLive);
      await t.tap(find.byTooltip('My profile'));
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.profile);
      await _go(t, RoutePaths.trackLive);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.home);
    });
  });

  group('Behaviour', () {
    testWidgets('pulse, filters, acknowledge, details and actions', (t) async {
      await pumpApp(t, location: RoutePaths.behaviour);
      expect(find.text('OVERALL CONDUCT PULSE'), findsOneWidget);
      expect(find.text('Review'), findsOneWidget); // one open flag
      expect(find.text('Rank #3'), findsOneWidget);

      await _press(t, find.text('Guidance & Notes (2)'));
      expect(find.text('Late Homework Submission'), findsOneWidget);
      expect(find.text('Academic Leadership'), findsNothing);
      await _press(t, find.text('Commendations (2)'));
      expect(find.text('Civic Responsibility'), findsOneWidget);
      expect(find.text('Late Homework Submission'), findsNothing);
      await _press(t, find.text('Praise & Stars (6)'));
      expect(find.text('Academic Leadership'), findsOneWidget);
      await _press(t, find.text('All Entries (8)'));

      // Details sheet.
      await _press(t, find.text('Academic Leadership'));
      expect(find.text('LOGGED BY'), findsOneWidget);
      await t.tap(find.widgetWithText(AppButton, 'Close'));
      await t.pumpAndSettle();

      // Acknowledge the open guidance note with a reply.
      final ack = find.byKey(const ValueKey('ack-cd_stu_aarav_3'));
      await _reveal(t, ack);
      await t.tap(ack);
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextFormField).last, 'We will plan better');
      await t.tap(find.widgetWithText(AppButton, 'Acknowledge'));
      await t.pumpAndSettle();
      expect(
        find.textContaining('Acknowledged. Mr. Imran Khan'),
        findsOneWidget,
      );
      expect(ack, findsNothing);
      await t.pump(const Duration(seconds: 3));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.text('Clean'),
        -250,
        scrollable: _vertical.first,
      );
      expect(find.text('Clean'), findsOneWidget);

      final transcript = find.text('Transcript (PDF)');
      await _reveal(t, transcript);
      await t.tap(transcript);
      await t.pump();
      await _snack(t, 'Conduct transcript');
      await t.tap(find.text('Message Teacher'));
      await t.pumpAndSettle();
      expect(_loc(t), startsWith('/messages/thread/th_stu_aarav_ct'));
    });
  });

  group('Apply Leave', () {
    testWidgets('impact, validation, attachment and submit', (t) async {
      await pumpApp(t, location: RoutePaths.leaveApply);
      expect(find.text('CBSE Attendance Impact'), findsOneWidget);
      expect(find.text('5 Days Left'), findsOneWidget);
      expect(find.textContaining('Left'), findsNWidgets(2)); // medical + casual
      expect(find.byKey(const Key('leave-projected-pct')), findsOneWidget);
      expect(find.text('1 Working Day'), findsOneWidget);

      final submit = find.text('Submit Leave Application');
      await _reveal(t, submit);
      await t.tap(submit);
      await t.pumpAndSettle();
      await _reveal(t, find.text('Please give a reason.'));
      expect(find.text('Please give a reason.'), findsOneWidget);

      // Category changes the attachment label.
      await _press(t, find.text('Family Event'));
      expect(find.text('Supporting Document'), findsOneWidget);

      // Date pickers open and confirm.
      await _press(t, find.byKey(const Key('leave-from')));
      await t.tap(find.text('OK'));
      await t.pumpAndSettle();
      await _press(t, find.byKey(const Key('leave-to')));
      await t.tap(find.text('Cancel'));
      await t.pumpAndSettle();

      // Simulated attachment, removed and added again.
      final box = find.text('Attach an invitation or letter');
      await _reveal(t, box);
      await t.tap(box);
      await t.pumpAndSettle();
      await t.tap(find.text('Browse files'));
      await t.pumpAndSettle();
      expect(find.byType(AppFileChip), findsOneWidget);
      await t.tap(find.byTooltip('Remove attachment'));
      await t.pumpAndSettle();
      expect(find.byType(AppFileChip), findsNothing);
      await t.tap(box);
      await t.pumpAndSettle();
      await t.tap(find.text('Take a photo'));
      await t.pumpAndSettle();
      await t.pump(const Duration(seconds: 3));
      await t.pumpAndSettle();

      await t.enterText(
        find.byKey(const Key('leave-reason')),
        'Cousin wedding',
      );
      await _reveal(t, submit);
      await t.tap(submit);
      await t.pumpAndSettle();
      expect(
        find.text('Leave application sent to Mrs. Anita Sharma'),
        findsOneWidget,
      );
      expect(_loc(t), RoutePaths.leave);
      expect(find.textContaining('Family Event • 1 day'), findsOneWidget);
      expect(find.byType(AppFileChip), findsOneWidget);
    });

    testWidgets('recent record links to the history; history applies', (
      t,
    ) async {
      await pumpApp(t, location: RoutePaths.leaveApply);
      final viewAll = find.text('View all');
      await _reveal(t, viewAll);
      expect(find.text('Recent Leave Record'), findsOneWidget);
      await t.tap(viewAll);
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.leave);
      expect(find.text('LEAVE HISTORY'), findsOneWidget);
      await t.tap(find.text('Apply for leave'));
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.leaveApply);
      await t.tap(find.byTooltip('Back'));
      await t.pumpAndSettle();
      expect(_loc(t), RoutePaths.leave);
    });
  });

  testWidgets('Live classes keep working under the new header', (t) async {
    await pumpApp(t, location: RoutePaths.liveClasses);
    expect(find.text('LIVE CLASSES'), findsOneWidget);
    expect(find.text('Upcoming and live'.toUpperCase()), findsWidgets);
    expect(find.byType(FilledButton), findsWidgets);
  });
}
