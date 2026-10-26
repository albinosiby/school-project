import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/config/routes/routes_config.dart';
import 'package:teacher_app/design_system/design_system.dart';
import 'package:teacher_app/di/global_blocs.dart';
import 'helpers/pump_app.dart';
import 'landscape_test.dart' show ignoreOverflow;

/// Every screen opens at phone, tablet and desktop sizes without an exception and without leaking
/// placeholder text such as "null" or "NaN" (overflow is ignored: the test font is wider than the app font).
const _routes = [
  '/home', '/timetable', '/classes', '/tasks', '/more', '/profile/settings', '/notifications', '/profile', '/profile/faculty-id',
  '/timetable/weekly', '/classes/behaviour', '/classes/behaviour/new', '/classes/resources', '/students', '/homework/new', '/tasks/add',
  '/duties', '/attendance/mark', '/attendance/trends', '/attendance/self-log', '/attendance/medical-slips', '/attendance/history',
  '/marks', '/marks/enter', '/leave/apply', '/circulars', '/lesson-plans', '/tests', '/tests/new', '/certificates', '/certificates/mine',
  '/certificates/issue', '/certificates/templates', '/live-classes', '/live-classes/schedule', '/leave-management',
  '/leave-management/students', '/meetings', '/meetings/schedule', '/exam-duties', '/messages', '/messages/new', '/messages/drafts',
];
final _bad = RegExp(r'\b(null|NaN|undefined|Invalid Date|Instance of)\b');

void main() {
  setUp(setUpTestApp);
  for (final size in const [Size(390, 844), Size(1024, 768), Size(1440, 900)]) {
    testWidgets('all routes render at ${size.width.toInt()}x${size.height.toInt()}', (t) async {
      ignoreOverflow();
      t.view.physicalSize = size;
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      await t.pumpWidget(ScreenUtilInit(
        designSize: size.width < 600 ? size : Size(size.width / (kContentMaxWidth / 390), size.height / (kContentMaxWidth / 390)),
        builder: (_, _) => MultiBlocProvider(providers: globalBlocProviders(), child: MaterialApp.router(theme: AppTheme.light, routerConfig: router)),
      ));
      final problems = <String>[];
      for (final r in _routes) {
        router.go(r);
        await t.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
        final err = t.takeException();
        if (err != null) problems.add('$r: $err');
        for (final w in t.widgetList<Text>(find.byType(Text))) {
          final s = w.data ?? w.textSpan?.toPlainText() ?? '';
          if (_bad.hasMatch(s)) problems.add('$r: text "$s"');
        }
      }
      expect(problems, isEmpty, reason: problems.join('\n'));
    });
  }
}
