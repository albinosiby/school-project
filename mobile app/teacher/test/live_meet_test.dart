import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/engage_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/engage/models/live_class_models.dart';
import 'package:teacher_app/modules/engage/models/live_class_rules.dart';
import 'package:teacher_app/utils/services/data_store.dart';
import 'package:teacher_app/utils/services/link_launcher.dart';
import 'helpers/pump_app.dart';

LiveSession _s({String time = '10:00', int mins = 45, LiveStatus status = LiveStatus.upcoming}) =>
    LiveSession(id: 'x', title: 'Algebra', classId: 'cls_10B', date: '2026-10-27', time: time, mins: mins, medium: 'Google Meet', link: 'https://meet.google.com/abc-defg-hij', status: status);

void main() {
  group('Meet link validation', () {
    test('accepts code links and lookup links', () {
      expect(validateMeetLink('https://meet.google.com/abc-defg-hij'), isNull);
      expect(validateMeetLink('meet.google.com/abc-defg-hij'), isNull);
      expect(validateMeetLink('  https://meet.google.com/abc-defg-hij?authuser=0 '), isNull);
      expect(validateMeetLink('https://meet.google.com/lookup/a1B2c3'), isNull);
      expect(validateMeetLink('meet.google.com/lookup/a1B2c3'), isNull);
    });
    test('rejects everything else with a message', () {
      expect(validateMeetLink(''), isNotNull);
      expect(validateMeetLink(null), isNotNull);
      expect(validateMeetLink('https://zoom.us/j/123456'), isNotNull);
      expect(validateMeetLink('https://meet.google.com/edu-trig-10'), isNotNull);
      expect(validateMeetLink('https://meet.google.com/abc-defg'), isNotNull);
      expect(validateMeetLink('https://evil.com/meet.google.com/abc-defg-hij'), isNotNull);
      expect(validateMeetLink('http://meet.google.com.evil.com/abc-defg-hij'), isNotNull);
    });
    test('normalises to https and lower case', () {
      expect(normalizeMeetLink('meet.google.com/ABC-DEFG-HIJ?x=1'), 'https://meet.google.com/abc-defg-hij');
      expect(normalizeMeetLink('http://meet.google.com/lookup/Zz9'), 'https://meet.google.com/lookup/Zz9');
      expect(normalizeMeetLink('nope'), isNull);
    });
  });

  group('join window', () {
    final start = DateTime(2026, 10, 27, 10);
    test('closed until 10 minutes before start', () {
      expect(_s().phase(start.subtract(const Duration(minutes: 11))), LivePhase.scheduled);
      expect(_s().canJoin(start.subtract(const Duration(minutes: 11))), isFalse);
    });
    test('open from start-10m through start+mins', () {
      expect(_s().canJoin(start.subtract(const Duration(minutes: 10))), isTrue);
      expect(_s().canJoin(start), isTrue);
      expect(_s().canJoin(start.add(const Duration(minutes: 44))), isTrue);
      expect(_s().phase(start.add(const Duration(minutes: 44))), LivePhase.open);
    });
    test('ended at start+mins even when the stored status is stale', () {
      final end = start.add(const Duration(minutes: 45));
      expect(_s().phase(end), LivePhase.ended);
      expect(_s(status: LiveStatus.live).canJoin(end), isFalse);
    });
    test('drafts never open', () {
      expect(_s(status: LiveStatus.draft).canJoin(start), isFalse);
      expect(_s(status: LiveStatus.draft).phase(start), LivePhase.draft);
    });
    test('labels derive from the clock', () {
      expect(_s().statusLabel(start.subtract(const Duration(hours: 2, minutes: 5))), 'Starts in 2h 5m');
      expect(_s().statusLabel(start.subtract(const Duration(minutes: 5))), 'Starts in 5m');
      expect(_s().statusLabel(start.add(const Duration(minutes: 1))), 'Live now');
      expect(_s().statusLabel(start.add(const Duration(hours: 2))), 'Ended');
    });
  });

  test('share message has title, class, time and link; WhatsApp uri encodes it', () {
    final m = shareMessage(_s(), className: '10-B', when: 'Tue, 27 Oct • 10:00 AM');
    expect(m, allOf(contains('Algebra'), contains('10-B'), contains('10:00 AM'), contains('https://meet.google.com/abc-defg-hij')));
    final u = whatsappShareUri(m);
    expect(u.host, 'wa.me');
    expect(u.queryParameters['text'], m);
  });

  group('screens', () {
    late List<Uri> launched;
    late bool launchOk;
    setUp(() async {
      await setUpTestApp();
      launched = [];
      launchOk = true;
      launchExternal = (u) async {
        launched.add(u);
        return launchOk;
      };
    });
    tearDown(() => launchExternal = (u) async => false);

    Future<void> pumpLive(WidgetTester t) async {
      final orig = FlutterError.onError;
      FlutterError.onError = (d) {
        if (!d.exceptionAsString().contains('overflowed')) orig?.call(d);
      };
      addTearDown(() => FlutterError.onError = orig);
      await pumpScreen(t, location: RoutePaths.liveClasses, routes: [GoRoute(path: RoutePaths.home, builder: (_, _) => const SizedBox()), ...engageRoutes]);
    }

    /// An open Meet class (starts in 5 minutes) as the first upcoming session.
    void openMeetClass() {
      final n = DateTime.now().add(const Duration(minutes: 5));
      String two(int v) => v.toString().padLeft(2, '0');
      getIt<DataStore>().add('lv_sessions', {
        'id': 'lv_meet', 'title': 'Meet now class', 'classId': 'cls_10B', 'audience': 'Class 10-B', 'subject': 'Mathematics', 'category': 'Doubt Clearing',
        'date': '${n.year}-${two(n.month)}-${two(n.day)}', 'time': '${two(n.hour)}:${two(n.minute)}', 'mins': 45, 'room': 'Room #01', 'medium': 'Google Meet',
        'link': 'https://meet.google.com/abc-defg-hij', 'record': false, 'mute': true, 'studentShare': false, 'notify': true, 'material': null, 'joined': 2, 'total': 42,
        'tag': '', 'status': 'upcoming', 'cohost': '',
      });
    }

    testWidgets('Join opens the Meet link externally and shows N joined', (t) async {
      openMeetClass();
      await pumpLive(t);
      expect(find.textContaining('2 joined'), findsOneWidget);
      await t.tap(find.text('Join Google Meet'));
      await t.pumpAndSettle();
      expect(launched.single.toString(), 'https://meet.google.com/abc-defg-hij');
      expect(find.text("Couldn't open Google Meet"), findsNothing);
    });

    testWidgets('failed launch shows the link with a copy action', (t) async {
      openMeetClass();
      launchOk = false;
      final clip = <String>[];
      t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (c) async {
        if (c.method == 'Clipboard.setData') clip.add((c.arguments as Map)['text'] as String);
        return null;
      });
      addTearDown(() => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
      await pumpLive(t);
      await t.tap(find.text('Join Google Meet'));
      await t.pumpAndSettle();
      expect(find.text("Couldn't open Google Meet"), findsOneWidget);
      expect(find.text('https://meet.google.com/abc-defg-hij'), findsOneWidget);
      await t.tap(find.text('Copy link'));
      await t.pumpAndSettle();
      expect(clip.single, 'https://meet.google.com/abc-defg-hij');
    });

    testWidgets('Share opens WhatsApp with title, class, time and link', (t) async {
      openMeetClass();
      await pumpLive(t);
      await t.tap(find.text('Share to WhatsApp'));
      await t.pumpAndSettle();
      expect(launched.single.host, 'wa.me');
      final text = launched.single.queryParameters['text']!;
      expect(text, allOf(contains('Meet now class'), contains('10–B'), contains('https://meet.google.com/abc-defg-hij')));
    });

    testWidgets('a class days away has Join disabled with a countdown', (t) async {
      await pumpLive(t);
      // the seeded Google Meet session two days out sits in the pipeline: Join is disabled
      await t.scrollUntilVisible(find.textContaining('Starts in'), 300, scrollable: find.byType(Scrollable).first);
      final disabled = find.byWidgetPredicate((w) => w is FilledButton && w.onPressed == null);
      expect(disabled, findsWidgets);
      expect(find.text('Join Google Meet'), findsNothing);
    });

    testWidgets('schedule form shows an inline error for a bad Meet link', (t) async {
      final orig = FlutterError.onError;
      FlutterError.onError = (d) {
        if (!d.exceptionAsString().contains('overflowed')) orig?.call(d);
      };
      addTearDown(() => FlutterError.onError = orig);
      await pumpScreen(t, location: RoutePaths.liveClassSchedule, routes: [GoRoute(path: RoutePaths.home, builder: (_, _) => const SizedBox()), ...engageRoutes]);
      await t.enterText(find.byType(TextFormField).first, 'Algebra revision clinic');
      await t.pump();
      await t.scrollUntilVisible(find.text('Google Meet'), 300, scrollable: find.byType(Scrollable).first);
      await t.tap(find.text('Google Meet'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(find.text('Google Meet link'), 300, scrollable: find.byType(Scrollable).first);
      await t.enterText(find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'https://meet.google.com/abc-defg-hij'), 'https://zoom.us/j/1');
      await t.pump();
      await t.tap(find.text('Schedule & Send'));
      await t.pumpAndSettle();
      expect(find.textContaining('Use a Google Meet link'), findsOneWidget);
      expect(getIt<DataStore>().list('lv_sessions').where((e) => e['title'] == 'Algebra revision clinic'), isEmpty);
    });
  });
}
