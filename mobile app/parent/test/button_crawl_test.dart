// Crawls every screen and taps every tappable element (each from a fresh app), recording taps that
// throw or have no visible effect. Run on demand:
//   flutter test test/button_crawl_test.dart --dart-define=CRAWL=true
// The report is written to build/button_crawl.txt.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'helpers/pump_app.dart';

const _enabled = bool.fromEnvironment('CRAWL');

final _routes = <String>[
  RoutePaths.home,
  RoutePaths.academicsSection('attendance'),
  RoutePaths.academicsSection('homework'),
  RoutePaths.academicsSection('marks'),
  RoutePaths.academicsSection('timetable'),
  RoutePaths.homework('hw_a1'),
  RoutePaths.marks('ex_a2'),
  RoutePaths.fees,
  RoutePaths.messages,
  RoutePaths.chatWith('th_stu_aarav_ct'),
  RoutePaths.newMessage,
  RoutePaths.more,
  RoutePaths.trackLive,
  RoutePaths.behaviour,
  RoutePaths.leave,
  RoutePaths.leaveApply,
  RoutePaths.liveClasses,
  RoutePaths.profile,
  RoutePaths.editProfile,
  RoutePaths.settings,
  RoutePaths.privacyPolicy,
  RoutePaths.notifications,
  RoutePaths.notification('nf_exam'),
  RoutePaths.studentProfile,
  RoutePaths.certificates,
  RoutePaths.ptm,
  RoutePaths.teachers,
  RoutePaths.selectChild,
];

final _publicRoutes = <String>[
  RoutePaths.welcome,
  RoutePaths.login,
  RoutePaths.forgotPassword,
  RoutePaths.register,
];

final _tappable = find.byWidgetPredicate(
  (w) => (w is InkResponse && (w.onTap != null || w.onLongPress != null)) ||
      (w is Switch && w.onChanged != null) ||
      (w is Checkbox && w.onChanged != null),
  skipOffstage: true,
);

String _describe(WidgetTester t, Finder f) {
  final texts = find.descendant(of: f, matching: find.byType(Text));
  final label = texts.evaluate().map((e) => (e.widget as Text).data ?? '').where((s) => s.isNotEmpty).join(' ');
  if (label.isNotEmpty) return label;
  final icons = find.descendant(of: f, matching: find.byType(Icon));
  if (icons.evaluate().isNotEmpty) {
    final icon = (icons.evaluate().first.widget as Icon).icon;
    final tip = find.ancestor(of: f, matching: find.byType(Tooltip));
    if (tip.evaluate().isNotEmpty) return 'tooltip:${(tip.evaluate().first.widget as Tooltip).message}';
    return 'icon:${icon?.codePoint.toRadixString(16)}';
  }
  return '(${f.evaluate().first.widget.runtimeType})';
}

/// Everything a user could notice: location, texts, switch/checkbox values, overlays.
String _snapshot(WidgetTester t) {
  final b = StringBuffer();
  final nav = find.byType(Navigator).evaluate();
  if (nav.isNotEmpty) {
    try {
      b.write(GoRouter.of(nav.first).routerDelegate.currentConfiguration.uri);
    } catch (_) {}
  }
  for (final e in find.byType(Text, skipOffstage: false).evaluate()) {
    b.write('|${(e.widget as Text).data}');
  }
  for (final e in find.byType(RichText, skipOffstage: false).evaluate()) {
    b.write('|${(e.widget as RichText).text.toPlainText()}');
  }
  for (final e in find.byType(Switch).evaluate()) {
    b.write('|sw${(e.widget as Switch).value}');
  }
  for (final e in find.byType(Checkbox).evaluate()) {
    b.write('|cb${(e.widget as Checkbox).value}');
  }
  for (final e in find.byType(DecoratedBox).evaluate()) {
    b.write('|d${(e.widget as DecoratedBox).decoration.hashCode}');
  }
  for (final e in find.byType(Material).evaluate()) {
    b.write('|m${(e.widget as Material).color?.toARGB32()}');
  }
  for (final e in find.byType(Icon).evaluate()) {
    final i = e.widget as Icon;
    b.write('|i${i.icon?.codePoint}${i.color?.toARGB32()}');
  }
  b.write('|routes${find.byType(ModalBarrier, skipOffstage: false).evaluate().length}');
  b.write('|ink${find.byType(InkResponse, skipOffstage: false).evaluate().length}');
  return b.toString();
}

Future<void> _settle(WidgetTester t) async {
  for (var i = 0; i < 6; i++) {
    await t.pump(const Duration(milliseconds: 250));
  }
}

/// The page's main vertical scroll view (the one with the most content).
ScrollPosition? _mainScroll(WidgetTester t) {
  ScrollPosition? best;
  for (final e in find.byType(Scrollable).evaluate()) {
    final s = (e as StatefulElement).state as ScrollableState;
    final p = s.position;
    if (p.axis != Axis.vertical || !p.hasContentDimensions) continue;
    if (best == null || p.maxScrollExtent > best.maxScrollExtent) best = p;
  }
  return best;
}

Future<bool> _open(
  WidgetTester t,
  String route, {
  required bool signedIn,
  int page = 0,
}) async {
  await t.pumpWidget(const SizedBox());
  await setUpTestApp(signedIn: signedIn);
  await pumpApp(t, location: route);
  await _settle(t);
  if (page == 0) return true;
  final pos = _mainScroll(t);
  final target = page * 500.0;
  if (pos == null || pos.maxScrollExtent < target - 400) return false;
  pos.jumpTo(target.clamp(0, pos.maxScrollExtent));
  await _settle(t);
  return true;
}

void main() {
  final report = <String>[];

  tearDownAll(() {
    if (!_enabled) return;
    Directory('build').createSync(recursive: true);
    File('build/button_crawl.txt').writeAsStringSync(report.join('\n'));
  });

  for (final (routes, signedIn) in [(_routes, true), (_publicRoutes, false)]) {
    for (final route in routes) {
      testWidgets('crawl $route', skip: !_enabled, (t) async {
        await _open(t, route, signedIn: signedIn);
        final open = t.takeException();
        if (open != null) report.add('ERROR  $route  opening: $open');
        final seen = <String>{};
        var total = 0;
        for (var page = 0; page < 12; page++) {
          if (!await _open(t, route, signedIn: signedIn, page: page)) break;
          final count = _tappable.evaluate().length;
          for (var i = 0; i < count; i++) {
            if (i > 0) await _open(t, route, signedIn: signedIn, page: page);
            final all = _tappable.evaluate().toList();
            if (i >= all.length) break;
            final f = find.byElementPredicate((e) => identical(e, all[i]));
            final name = _describe(t, f);
            if (!seen.add(name)) continue;
            total++;
            try {
              await Scrollable.ensureVisible(f.evaluate().first, alignment: .35);
              await _settle(t);
            } catch (_) {}
            final before = _snapshot(t);
            try {
              await t.tap(f, warnIfMissed: false);
            } catch (e) {
              report.add('ERROR  $route  [$name] tap failed: $e');
              continue;
            }
            await _settle(t);
            final err = t.takeException();
            if (err != null) {
              report.add('ERROR  $route  [$name] threw: ${err.toString().split('\n').first}');
              continue;
            }
            if (_snapshot(t) == before) report.add('DEAD?  $route  [$name]');
          }
        }
        report.add('SCREEN $route  ($total distinct tappables)');
        await t.pumpWidget(const SizedBox());
        await t.pump(const Duration(seconds: 1));
      });
    }
  }
}
