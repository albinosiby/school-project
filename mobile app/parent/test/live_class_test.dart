import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/modules/live_classes/bloc/live_classes_bloc.dart';
import 'package:parent_app/modules/live_classes/models/live_class_models.dart';
import 'package:parent_app/modules/live_classes/repositories/live_class_repository_interface.dart';
import 'package:parent_app/modules/live_classes/screens/widgets/live_class_card.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:parent_app/di/injection.dart';
import 'helpers/pump_app.dart';

final _start = DateTime(2026, 11, 2, 16, 0);
final _class = LiveClass(
  id: 'lv',
  title: 'Algebra',
  subject: 'Mathematics',
  teacher: 'Mrs. Anita Sharma',
  start: _start,
  mins: 45,
  link: 'https://meet.google.com/abc-defg-hij',
);

void main() {
  group('join window (DATA_CONTRACT section 6)', () {
    test('opens 10 minutes before the start', () {
      expect(
        _class.canJoinAt(_start.subtract(const Duration(minutes: 11))),
        isFalse,
      );
      expect(
        _class.canJoinAt(_start.subtract(const Duration(minutes: 10))),
        isTrue,
      );
      expect(
        _class.canJoinAt(_start.subtract(const Duration(minutes: 1))),
        isTrue,
      );
    });

    test('closes at start + mins', () {
      expect(_class.canJoinAt(_start.add(const Duration(minutes: 44))), isTrue);
      expect(
        _class.canJoinAt(_start.add(const Duration(minutes: 45))),
        isFalse,
      );
      expect(_class.canJoinAt(_start.add(const Duration(hours: 3))), isFalse);
    });

    test('status is derived from the clock', () {
      expect(
        _class.statusAt(_start.subtract(const Duration(minutes: 5))),
        LiveStatus.upcoming,
      );
      expect(_class.statusAt(_start), LiveStatus.live);
      expect(
        _class.statusAt(_start.add(const Duration(minutes: 45))),
        LiveStatus.ended,
      );
    });
  });

  Future<void> pumpCard(
    WidgetTester t,
    DateTime now, {
    VoidCallback? onJoin,
  }) async {
    ignoreOverflow();
    await t.pumpWidget(
      ScreenUtilInit(
        designSize: const Size(390, 844),
        builder: (_, _) => MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: LiveClassCard(
              item: _class,
              clock: () => now,
              onJoin: onJoin ?? () {},
            ),
          ),
        ),
      ),
    );
    await t.pump();
  }

  Finder joinButton() => find.byType(FilledButton);

  testWidgets('Join is disabled before the window opens', (t) async {
    await pumpCard(t, _start.subtract(const Duration(minutes: 30)));
    expect(t.widget<FilledButton>(joinButton()).onPressed, isNull);
    expect(find.textContaining('Join opens at'), findsOneWidget);
  });

  testWidgets('Join is enabled 10 minutes before the start and fires onJoin', (
    t,
  ) async {
    var joined = 0;
    await pumpCard(
      t,
      _start.subtract(const Duration(minutes: 10)),
      onJoin: () => joined++,
    );
    expect(t.widget<FilledButton>(joinButton()).onPressed, isNotNull);
    await t.tap(joinButton());
    expect(joined, 1);
  });

  testWidgets('no Join button once the class has ended', (t) async {
    await pumpCard(t, _start.add(const Duration(minutes: 46)));
    expect(joinButton(), findsNothing);
    expect(find.text('Ended'), findsOneWidget);
  });

  group('join flow', () {
    testWidgets('opens the Meet link externally and records the join', (
      t,
    ) async {
      final launcher = await setUpTestApp();
      await t.pumpWidget(
        BlocProvider<LiveClassesBloc>(
          create: (_) => getIt<LiveClassesBloc>(),
          child: ScreenUtilInit(
            designSize: const Size(390, 844),
            builder: (_, _) => MaterialApp(
              home: Builder(
                builder: (ctx) => TextButton(
                  onPressed: () => joinLiveClass(ctx, _class),
                  child: const Text('go'),
                ),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('go'));
      await t.pumpAndSettle();
      expect(launcher.opened, [_class.link]);
      expect(find.text('Could not open Google Meet'), findsNothing);
      expect((getIt<ILiveClassRepository>() as dynamic).joins, contains('lv'));
    });

    testWidgets('shows the link with a copy action when it cannot be opened', (
      t,
    ) async {
      await setUpTestApp(launcherSucceeds: false);
      ignoreOverflow();
      await t.pumpWidget(
        BlocProvider<LiveClassesBloc>(
          create: (_) => getIt<LiveClassesBloc>(),
          child: ScreenUtilInit(
            designSize: const Size(390, 844),
            builder: (_, _) => MaterialApp(
              theme: AppTheme.light,
              home: Builder(
                builder: (ctx) => TextButton(
                  onPressed: () => joinLiveClass(ctx, _class),
                  child: const Text('go'),
                ),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('go'));
      await t.pumpAndSettle();
      expect(find.text('Could not open Google Meet'), findsOneWidget);
      expect(find.text(_class.link), findsOneWidget);
      expect(find.byTooltip('Copy meet link'), findsOneWidget);
    });
  });
}
