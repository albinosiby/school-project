import 'dart:io';
import 'package:driver_app/config/routes/routes_config.dart';
import 'package:driver_app/di/demo_data.dart';
import 'package:driver_app/di/injection.dart';
import 'package:driver_app/main.dart';
import 'package:driver_app/modules/auth/bloc/auth_bloc.dart';
import 'package:driver_app/modules/trips/models/trip_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/pump_app.dart';

/// Every route at the size of the test phone (moto g60: 1080 x 2460 px at 2.5 = 432 x 984 dp), portrait and landscape,
/// at the phone's system text scale 1.15, with the app's real font loaded so overflow reports are meaningful.
/// Fails on any RenderFlex overflow or other layout exception.
Future<void> _loadFonts() async {
  final weights = {'ExtraLight': 200, 'Light': 300, 'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800};
  for (final e in weights.entries) {
    final bytes = File('assets/fonts/PlusJakartaSans-${e.key}.ttf').readAsBytesSync();
    // google_fonts registers each weight as its own family "PlusJakartaSans_<weight>"
    final loader = FontLoader('PlusJakartaSans_${e.value}')..addFont(Future.value(ByteData.view(bytes.buffer)));
    await loader.load();
  }
}

const _portrait = Size(432, 984), _landscape = Size(984, 432);
/// landscape with the soft keyboard up (moto g60: about 250 dp), the case that overflowed the navigation rail on the phone
const _keyboard = Size(984, 182);

Future<List<String>> _pump(WidgetTester tester, String location, Size size) async {
  final errors = <String>[];
  final old = FlutterError.onError;
  FlutterError.onError = (d) => errors.add(d.exceptionAsString().split('\n').first);
  addTearDown(() => FlutterError.onError = old);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = 1.15;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  final router = createRouter(getIt<AuthBloc>(), initialLocation: location);
  await tester.pumpWidget(DriverApp(router: router));
  await tester.pumpAndSettle();
  // scroll the main list to the end so lower sections lay out too
  final lists = find.byType(Scrollable);
  if (lists.evaluate().isNotEmpty) {
    await tester.drag(lists.first, const Offset(0, -3000), warnIfMissed: false);
    await tester.pumpAndSettle();
  }
  FlutterError.onError = old;
  return errors;
}

void main() {
  setUpAll(_loadFonts);
  final store = DemoStore();
  final pickup = Trip.idFor(store.today, 'bus_01', TripKind.pickup);
  final signedIn = <String>[
    '/home', '/trips', '/students', '/profile', '/trips/history', '/trips/$pickup', '/trips/$pickup/checklist',
    '/students/stops', '/profile/attendance', '/profile/leave', '/profile/leave/apply', '/profile/edit', '/notices', '/notices/ntc_1',
  ];
  for (final (label, size) in [('portrait', _portrait), ('landscape', _landscape), ('landscape+keyboard', _keyboard)]) {
    for (final role in ['crw_001', 'crw_002']) {
      for (final route in signedIn) {
        testWidgets('$label $role $route lays out without overflow', (tester) async {
          await setUpTestApp(signedInAs: role);
          final errors = await _pump(tester, route, size);
          expect(errors, isEmpty, reason: errors.join('\n'));
        });
      }
    }
    for (final route in ['/welcome', '/login', '/login/forgot']) {
      testWidgets('$label signed out $route lays out without overflow', (tester) async {
        await setUpTestApp();
        final errors = await _pump(tester, route, size);
        expect(errors, isEmpty, reason: errors.join('\n'));
      });
    }
  }
}
