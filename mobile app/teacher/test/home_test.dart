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
import 'package:teacher_app/modules/home/models/home_models.dart';
import 'package:teacher_app/modules/home/models/timetable_models.dart';
import 'package:teacher_app/modules/school/models/school_models.dart';
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

  group('marking route', () {
    test('opens the marking screen on the given class and period', () {
      expect(RoutePaths.markAttendance(classId: 'cls_5B', period: 3), '/attendance/mark?class=cls_5B&period=3');
      expect(RoutePaths.markAttendance(classId: 'cls_5B'), '/attendance/mark?class=cls_5B');
      expect(RoutePaths.markAttendance(), '/attendance/mark');
    });
  });

  group('attention list', () {
    test('lists pending substitutions, unmarked class-teacher classes once school has started, then open tasks', () {
      const cls = SchoolClass(id: 'cls_9A', grade: '9', section: 'A', subject: 'Maths', topic: '', room: 'R1', wing: '', students: 30, classTeacher: true, rep: '', attendance: 90);
      const other = SchoolClass(id: 'cls_8B', grade: '8', section: 'B', subject: 'Maths', topic: '', room: 'R2', wing: '', students: 28, classTeacher: false, rep: '', attendance: 90);
      const task = PendingTask(id: 'hp_1', tag: 'Marks', tone: 'purple', due: 'Due today', title: 'Enter marks', desc: '', route: '/tasks');
      const sub = Substitution(id: 'sub_1', day: 1, slot: 'P2', status: SubStatus.pending, classLabel: '7-B', subject: 'Science', faculty: '', dept: '', role: '', room: '', posted: '', tag: '', chapter: '', objective: '', directive: '');
      final state = const HomeState(status: HomeStatus.loaded).copyWith(pending: [task, task.copyWith(done: true)], subs: [sub]);
      final morning = schoolNow(DateTime(2026, 10, 26, 10, 20)); // Monday, during school
      final items = attentionItems(state, [cls, other], morning);
      expect(items.map((i) => i.id), ['sub_sub_1', 'att_cls_9A', 'task_hp_1']);
      expect(items.first.sub, contains('Today'));
      expect(items[1].title, 'Mark attendance • Class 9-A');
      expect(items[1].route, '/attendance/mark?class=cls_9A');
      expect(items.last.taskId, 'hp_1');
      // a saved draft asks to finish, a submitted record or a time before school removes the row
      final drafted = attentionItems(state.copyWith(drafts: {'cls_9A'}), [cls], morning);
      expect(drafted[1].title, 'Finish attendance • Class 9-A');
      expect(drafted[1].sub, contains('Draft saved'));
      expect(attentionItems(state.copyWith(today: {'cls_9A': (total: 30, present: 28, absent: 2, late: 0, excused: 0)}), [cls], morning).map((i) => i.id), ['sub_sub_1', 'task_hp_1']);
      expect(attentionItems(state, [cls], schoolNow(DateTime(2026, 10, 26, 7, 0))).map((i) => i.id), ['sub_sub_1', 'task_hp_1']);
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
      bloc.add(SettingsChanged(bloc.state.settings.copyWith(sound: false, parentMessages: false)));
      await expectLater(bloc.stream, emitsThrough(predicate<SettingsState>((s) => !s.settings.sound)));
      final saved = await getIt<ISettingsRepository>().get();
      expect(saved.sound, isFalse);
      expect(saved.parentMessages, isFalse);
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
      expect(find.text('Edvio Teacher'), findsOneWidget);
      final hasLive = find.textContaining('NOW HAPPENING').evaluate().isNotEmpty;
      if (!hasLive) expect(find.textContaining(RegExp('Break until|No class in progress')), findsOneWidget);
      expect(find.text("Today's Schedule"), findsOneWidget);
      expect(find.text('Attendance'), findsOneWidget); // quick actions sit right under the now card
      await t.scrollUntilVisible(find.text('Needs your attention'), 200, scrollable: find.byType(Scrollable).first);
      await t.ensureVisible(find.byTooltip('Mark done').first);
      await t.pumpAndSettle();
      expect(find.byTooltip('Mark done', skipOffstage: false), findsNWidgets(4));
      await t.tap(find.byTooltip('Mark done').first);
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().byId('hm_pending', 'hp_1')!['done'], isTrue);
      expect(find.byTooltip('Mark done', skipOffstage: false), findsNWidgets(3));
      expect(find.text('My Classes', skipOffstage: false), findsOneWidget);
      expect(find.textContaining('DAILY INSPIRATION', skipOffstage: false), findsNothing);
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

    testWidgets('notifications: opening marks all read, new ones stay highlighted, filter, open and delete', (t) async {
      await _pump(t, RoutePaths.notifications);
      expect(find.text('3 new'), findsOneWidget);
      // opening the page marks everything read at once (no mark-all button any more)
      expect(getIt<LocalDatabaseService>().list('notifications').where((n) => n['read'] != true), isEmpty);
      expect(find.byTooltip('Mark all as read'), findsNothing);
      await t.tap(find.text('New  3'));
      await t.pumpAndSettle();
      expect(find.text('Ananya Reddy (#02 • 10-B)'), findsOneWidget);
      expect(find.text('Circular CIR-2024-089 Published'), findsNothing);
      await t.tap(find.text('All  8'));
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

      // the staff record's tab strip is a second Scrollable, so name the page list
      await t.scrollUntilVisible(find.text('Notification & Account Settings'), 300, scrollable: find.byType(Scrollable).first);
      await t.ensureVisible(find.text('Notification & Account Settings'));
      await t.pump(const Duration(milliseconds: 400)); // the version row's shimmer never settles in tests
      await t.tap(find.text('Notification & Account Settings'));
      await t.pumpAndSettle();
      expect(find.text('Class & Student Updates'), findsOneWidget);
      await t.tap(find.text('Sound & Vibration'));
      await t.pumpAndSettle();
      expect(getIt<LocalDatabaseService>().doc('settings')['sound'], false);
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
      expect(find.text('Welcome to Edvio'), findsOneWidget);
    });

    testWidgets('home shows the teacher\'s own check-in and records the punch', (t) async {
      await _pump(t, RoutePaths.home);
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('MY ATTENDANCE'), findsOneWidget);
      if (find.text('Check In').evaluate().isNotEmpty) {
        await t.tap(find.text('Check In'));
        await t.pump(const Duration(milliseconds: 600));
        expect(find.text('Check Out'), findsOneWidget);
        expect(find.textContaining('Checked in'), findsWidgets);
      } else {
        // the demo seed already has today's punch
        expect(find.text('Check Out').evaluate().isNotEmpty || find.textContaining('Checked out at').evaluate().isNotEmpty, isTrue);
      }
    });

    testWidgets('faculty id renders', (t) async {
      await _pump(t, RoutePaths.facultyId);
      expect(find.text('FACULTY PASS'), findsOneWidget);
      expect(find.text('EMPLOYEE ID'), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w is Semantics && (w.properties.label ?? '').startsWith('QR code for employee ID')), findsOneWidget);
      expect(find.text('Download PDF'), findsOneWidget);
    });

    testWidgets('onboarding completes and stores the flag', (t) async {
      await getIt<LocalStorageService>().remove('onboarding_complete');
      await _pump(t, RoutePaths.onboarding);
      expect(find.text('Welcome to Edvio'), findsOneWidget);
      await t.tap(find.text('Get Started'));
      await t.pumpAndSettle();
      expect(find.text('Confirm Your Profile'), findsOneWidget);
      expect(find.text('4 Confirmed'), findsOneWidget);
      await t.tap(find.text('Confirm & Continue'));
      await t.pumpAndSettle();
      expect(getIt<LocalStorageService>().isOnboardingComplete, isTrue);
      expect(find.text('Edvio Teacher'), findsOneWidget);
    });
  });
}
