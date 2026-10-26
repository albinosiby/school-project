import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/home_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/home/bloc/home_bloc.dart';
import 'package:teacher_app/modules/home/bloc/home_events.dart';
import 'package:teacher_app/modules/home/bloc/home_states.dart';
import 'package:teacher_app/modules/home/bloc/notifications_bloc.dart';
import 'package:teacher_app/modules/home/bloc/notifications_events.dart';
import 'package:teacher_app/modules/home/bloc/notifications_states.dart';
import 'package:teacher_app/modules/home/bloc/profile_bloc.dart';
import 'package:teacher_app/modules/home/bloc/profile_events.dart';
import 'package:teacher_app/modules/home/bloc/profile_states.dart';
import 'package:teacher_app/modules/home/bloc/settings_bloc.dart';
import 'package:teacher_app/modules/home/bloc/settings_events.dart';
import 'package:teacher_app/modules/home/bloc/settings_states.dart';
import 'package:teacher_app/modules/home/bloc/substitution_bloc.dart';
import 'package:teacher_app/modules/home/bloc/substitution_events.dart';
import 'package:teacher_app/modules/home/bloc/substitution_states.dart';
import 'package:teacher_app/modules/home/bloc/timetable_bloc.dart';
import 'package:teacher_app/modules/home/bloc/timetable_events.dart';
import 'package:teacher_app/modules/home/bloc/timetable_states.dart';
import 'package:teacher_app/modules/home/models/timetable_models.dart';
import 'package:teacher_app/modules/home/repositories/settings_repository_interface.dart';
import 'package:teacher_app/modules/home/screens/home_screen.dart';
import 'package:teacher_app/modules/home/screens/timetable_screen.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'package:teacher_app/utils/services/local_storage_service.dart';
import 'helpers/pump_app.dart';

/// The test font is wider than Inter, so RenderFlex overflow reports are not meaningful here.
void ignoreOverflow() {
  final prev = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    prev?.call(d);
  };
  addTearDown(() => FlutterError.onError = prev);
}

Widget _stub(String label) => Scaffold(body: Center(child: Text(label)));

final _routes = <RouteBase>[
  GoRoute(path: RoutePaths.home, builder: (_, _) => const Scaffold(body: SafeArea(child: HomeScreen()))),
  GoRoute(path: RoutePaths.timetable, builder: (_, _) => const Scaffold(body: SafeArea(child: TimetableScreen()))),
  ...homeRoutes,
  GoRoute(path: RoutePaths.attendanceMark, builder: (_, _) => _stub('ATT')),
  GoRoute(path: RoutePaths.lessonPlans, builder: (_, _) => _stub('LP')),
  GoRoute(path: RoutePaths.showcase, builder: (_, _) => _stub('SHOWCASE')),
  GoRoute(path: RoutePaths.marksEnter, builder: (_, _) => _stub('MARKS')),
  GoRoute(path: RoutePaths.leaveManagement, builder: (_, _) => _stub('LEAVES')),
];

Future<void> _pump(WidgetTester t, String location) async {
  ignoreOverflow();
  await pumpScreen(t, location: location, routes: _routes);
}

void main() {
  setUp(setUpTestApp);

  group('timetable helpers', () {
    test('clock, simulated now and term week', () {
      expect(t12('13:15'), '1:15 PM');
      final sunday = schoolNow(DateTime(2026, 10, 25, 11));
      expect(sunday.simulated, isTrue);
      expect(sunday.minute, 10 * 60 + 40);
      final live = schoolNow(DateTime(2026, 10, 26, 10, 20));
      expect(live.simulated, isFalse);
      expect(termWeek(DateTime(2026, 10, 24)), 8);
    });

    test('declined substitution becomes a free period', () async {
      final bloc = getIt<TimetableBloc>()..add(const TimetableLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<TimetableState>((s) => s.status == TimetableStatus.loaded)));
      expect(bloc.state.periods.length, 36);
      expect(bloc.state.periodsOf(1).firstWhere((p) => p.slot == 'P5').kind, PeriodKind.sub);
      getIt<LocalDatabaseService>().update('tt_subs', 'sub_1', {'status': 'declined'});
      await expectLater(bloc.stream, emitsThrough(predicate<TimetableState>((s) => s.periodsOf(1).firstWhere((p) => p.slot == 'P5').kind == PeriodKind.prep)));
      await bloc.close();
    });
  });

  group('blocs', () {
    test('HomeBloc loads and completes a task', () async {
      final bloc = getIt<HomeBloc>()..add(const HomeLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<HomeState>((s) => s.status == HomeStatus.loaded && s.open.length == 4)));
      bloc.add(const HomeTaskCompleted('hp_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<HomeState>((s) => s.open.length == 3)));
      await bloc.close();
    });

    test('SubstitutionBloc accepts and toggles tasks', () async {
      final bloc = getIt<SubstitutionBloc>()..add(const SubstitutionLoadRequested('sub_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<SubstitutionState>((s) => s.sub?.status == SubStatus.pending)));
      bloc.add(const SubstitutionStatusChanged(SubStatus.accepted));
      await expectLater(bloc.stream, emitsThrough(predicate<SubstitutionState>((s) => s.sub?.status == SubStatus.accepted)));
      bloc.add(const SubstitutionTaskToggled(1));
      await expectLater(bloc.stream, emitsThrough(predicate<SubstitutionState>((s) => s.sub!.doneCount == 2)));
      await bloc.close();
      final missing = getIt<SubstitutionBloc>()..add(const SubstitutionLoadRequested('nope'));
      await expectLater(missing.stream, emitsThrough(predicate<SubstitutionState>((s) => s.status == SubstitutionLoadStatus.notFound)));
      await missing.close();
    });

    test('SettingsBloc persists changes', () async {
      final bloc = getIt<SettingsBloc>()..add(const SettingsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<SettingsState>((s) => s.status == SettingsStatus.loaded)));
      expect(bloc.state.settings.sound, isTrue);
      bloc.add(SettingsChanged(bloc.state.settings.copyWith(sound: false, sync: 'Hourly')));
      await expectLater(bloc.stream, emitsThrough(predicate<SettingsState>((s) => !s.settings.sound)));
      final saved = await getIt<ISettingsRepository>().get();
      expect(saved.sound, isFalse);
      expect(saved.sync, 'Hourly');
      await bloc.close();
    });

    test('ProfileBloc loads faculty details', () async {
      final bloc = getIt<ProfileBloc>()..add(const ProfileLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<ProfileState>((s) => s.status == ProfileStatus.loaded)));
      expect(bloc.state.profile.qualifications.length, 3);
      expect(bloc.state.profile.token, 'DPS-FAC-2018-042-MTH');
      await bloc.close();
    });

    test('NotificationsBloc deletes read notifications', () async {
      final bloc = getIt<NotificationsBloc>()..add(const NotificationsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<NotificationsState>((s) => s.loaded && s.items.length == 8)));
      bloc.add(const NotificationsReadDeleted());
      await expectLater(bloc.stream, emitsThrough(predicate<NotificationsState>((s) => s.items.length == 3 && s.unread == 3)));
      await bloc.close();
    });
  });

  group('screens', () {
    testWidgets('home shows the now card, marks a task done and syncs', (t) async {
      await _pump(t, RoutePaths.home);
      expect(find.text('Teacher Portal'), findsOneWidget);
      final hasLive = find.textContaining('NOW HAPPENING').evaluate().isNotEmpty;
      if (!hasLive) expect(find.textContaining(RegExp('Break until|No class in progress')), findsOneWidget);
      expect(find.text("Today's Schedule"), findsOneWidget);
      await t.scrollUntilVisible(find.text('4 Pending'), 200, scrollable: find.byType(Scrollable).first);
      await t.ensureVisible(find.byTooltip('Mark done').first);
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('Mark done').first);
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().byId('hm_pending', 'hp_1')!['done'], isTrue);
      expect(find.text('3 Pending', skipOffstage: false), findsOneWidget);
      // no sync banner on Home: the data syncs by itself
      expect(find.byTooltip('Sync now'), findsNothing);
      expect(find.textContaining('Not synced'), findsNothing);
      await t.drag(find.byType(ListView).first, const Offset(0, 3000)); // back to the top (now card)
      await t.pumpAndSettle();
      if (hasLive) {
        await t.tap(find.text('Mark Attendance'));
        await t.pumpAndSettle();
        expect(find.text('ATT'), findsOneWidget);
      }
    });

    testWidgets('timetable toggles weekly grid and opens the weekly screen', (t) async {
      await _pump(t, RoutePaths.timetable);
      expect(find.textContaining('Schedule Timeline', findRichText: true), findsOneWidget);
      await t.tap(find.text('Weekly Grid'));
      await t.pumpAndSettle();
      expect(find.text('Horizontal Period Matrix'), findsOneWidget);
      expect(find.text('Weekly Timetable Grid'), findsOneWidget);
      await t.tap(find.text('Daily View'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(find.text('Open full weekly grid'), 300);
      await t.tap(find.text('Open full weekly grid'));
      await t.pumpAndSettle();
      expect(find.text('Weekly Timetable'), findsOneWidget);
      expect(find.text('Horizontal Period Matrix'), findsOneWidget);
    });

    testWidgets('substitution brief: toggle task, accept', (t) async {
      await _pump(t, RoutePaths.substitution('sub_1'));
      expect(find.text('Lesson Notes'), findsOneWidget);
      await t.scrollUntilVisible(find.text('Distribute friction worksheets'), 200);
      await t.ensureVisible(find.text('Distribute friction worksheets'));
      await t.pumpAndSettle();
      expect(find.text('1 of 4 Completed'), findsOneWidget);
      await t.tap(find.text('Distribute friction worksheets'));
      await t.pumpAndSettle();
      expect(find.text('2 of 4 Completed'), findsOneWidget);
      await t.tap(find.text('Accept'));
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().list('tt_subs').where((s) => s['status'] == 'accepted').length, 2);
      await t.drag(find.byType(ListView).first, const Offset(0, 3000));
      await t.pumpAndSettle();
      expect(find.text('Approved'), findsOneWidget);
    });

    testWidgets('substitution decline asks for confirmation and can be undone', (t) async {
      await _pump(t, RoutePaths.substitution('sub_1'));
      await t.tap(find.text('Decline'));
      await t.pumpAndSettle();
      await t.tap(find.text('Decline').last);
      await t.pumpAndSettle();
      expect(find.text('Declined'), findsOneWidget);
      await t.tap(find.text('Undo decline'));
      await t.pumpAndSettle();
      expect(find.text('Awaiting response'), findsOneWidget);
    });

    testWidgets('notifications filter, mark all read, open and delete', (t) async {
      await _pump(t, RoutePaths.notifications);
      expect(find.text('3 new'), findsOneWidget);
      await t.tap(find.text('Unread (3)'));
      await t.pumpAndSettle();
      expect(find.text('Ananya Reddy (#02 • 10-B)'), findsOneWidget);
      expect(find.text('Circular CIR-2024-089 Published'), findsNothing);
      await t.tap(find.byTooltip('Mark all as read'));
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().list('notifications').where((n) => n['read'] != true), isEmpty);
      await t.tap(find.text('All (8)'));
      await t.pumpAndSettle();
      await t.tap(find.text('Ananya Reddy (#02 • 10-B)'));
      await t.pumpAndSettle();
      expect(find.text('Leave Application Submitted'), findsOneWidget);
      expect(find.text('Review leave requests'), findsOneWidget);
      await t.tap(find.byTooltip('Delete notification'));
      await t.pumpAndSettle();
      await t.tap(find.text('Delete').last);
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().byId('notifications', 'n_1'), isNull);
    });

    testWidgets('notification detail opens its module route', (t) async {
      await _pump(t, RoutePaths.notification('n_1'));
      expect(getIt<LocalDatabaseService>().byId('notifications', 'n_1')!['read'], isTrue);
      await t.tap(find.text('Review leave requests'));
      await t.pumpAndSettle();
      expect(find.text('LEAVES'), findsOneWidget);
    });

    testWidgets('profile edits the teacher and settings persist', (t) async {
      await _pump(t, RoutePaths.profile);
      expect(find.text('Mrs. Anita Sharma'), findsOneWidget);
      expect(find.text('168'), findsOneWidget);
      await t.tap(find.byTooltip('Edit account'));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextFormField).first, 'Mrs. Anita S. Sharma');
      await t.tap(find.text('Save changes'));
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().doc('me')['name'], 'Mrs. Anita S. Sharma');
      expect(find.text('Mrs. Anita S. Sharma'), findsOneWidget);

      await t.scrollUntilVisible(find.text('Notification & Account Settings'), 300);
      await t.tap(find.text('Notification & Account Settings'));
      await t.pumpAndSettle();
      expect(find.text('Biometric Login'), findsOneWidget);
      await t.tap(find.text('Sound & Vibration'));
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().doc('settings')['sound'], false);
      await t.scrollUntilVisible(find.text('Design System'), 300);
      await t.tap(find.text('Design System'));
      await t.pumpAndSettle();
      expect(find.text('SHOWCASE'), findsOneWidget);
    });

    testWidgets('settings log out resets the walkthrough flag', (t) async {
      await _pump(t, RoutePaths.settings);
      await t.scrollUntilVisible(find.text('Log Out'), 300);
      await t.ensureVisible(find.text('Log Out'));
      await t.pumpAndSettle();
      await t.tap(find.text('Log Out'));
      await t.pumpAndSettle();
      await t.tap(find.text('Log Out').last);
      await t.pumpAndSettle();
      expect(getIt<LocalStorageService>().isOnboardingComplete, isFalse);
      expect(find.text('Welcome to EduAdmin'), findsOneWidget);
    });

    testWidgets('faculty id renders', (t) async {
      await _pump(t, RoutePaths.facultyId);
      expect(find.text('FACULTY PASS'), findsOneWidget);
      expect(find.text('DPS-FAC-2018-042-MTH'), findsOneWidget);
      expect(find.text('Download PDF'), findsOneWidget);
    });

    testWidgets('onboarding completes and stores the flag', (t) async {
      await getIt<LocalStorageService>().remove('onboarding_complete');
      await _pump(t, RoutePaths.onboarding);
      expect(find.text('Welcome to EduAdmin'), findsOneWidget);
      await t.tap(find.text('Get Started'));
      await t.pumpAndSettle();
      expect(find.text('Confirm Your Profile'), findsOneWidget);
      expect(find.text('4 Confirmed'), findsOneWidget);
      await t.tap(find.text('Confirm & Continue'));
      await t.pumpAndSettle();
      expect(getIt<LocalStorageService>().isOnboardingComplete, isTrue);
      expect(find.text('Teacher Portal'), findsOneWidget);
    });
  });
}
