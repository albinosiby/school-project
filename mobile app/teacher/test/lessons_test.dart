import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/lessons_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_bloc.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_events.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_states.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_bloc.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_events.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_states.dart';
import 'package:teacher_app/modules/lessons/bloc/online_tests_bloc.dart';
import 'package:teacher_app/modules/lessons/bloc/online_tests_events.dart';
import 'package:teacher_app/modules/lessons/bloc/online_tests_states.dart';
import 'package:teacher_app/modules/more/bloc/more_bloc.dart';
import 'package:teacher_app/modules/more/bloc/more_events.dart';
import 'package:teacher_app/modules/more/bloc/more_states.dart';
import 'package:teacher_app/modules/more/screens/more_screen.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

late LocalDatabaseService db;

Future<void> open(WidgetTester t, String location) async {
  await pumpScreen(t, location: location, routes: [
    GoRoute(path: RoutePaths.more, builder: (_, _) => const Scaffold(body: MoreScreen())),
    ...lessonsRoutes,
    for (final p in [RoutePaths.liveClasses, RoutePaths.messages, RoutePaths.timetable, RoutePaths.tasks]) GoRoute(path: p, builder: (_, _) => Text('AT $p')),
  ]);
}

Future<void> see(WidgetTester t, Finder f) async {
  await t.scrollUntilVisible(f, 300, scrollable: find.byType(Scrollable).first);
  await t.pump();
}

void main() {
  setUp(() async => db = await setUpTestApp());

  group('blocs', () {
    test('more bloc summarises other modules and reacts to changes', () async {
      final bloc = getIt<MoreBloc>()..add(const MoreLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<MoreState>((s) => s.status == MoreStatus.loaded)));
      expect(bloc.state.summary.activePlans, 3);
      expect(bloc.state.summary.draftPlans, 1);
      expect(bloc.state.summary.upcomingTests, 2);
      expect(bloc.state.summary.pendingCertificates, 4);
      final unread = db.list('ms_messages').fold<int>(0, (a, m) => a + (m['unread'] as int? ?? 0));
      expect(bloc.state.summary.unreadMessages, unread);
      db.update('ts_tests', 'ts_1', {'status': 'live'});
      await expectLater(bloc.stream, emitsThrough(predicate<MoreState>((s) => s.summary.upcomingTests == 1)));
      await bloc.close();
    });

    test('lesson plans bloc toggles milestones, creates and deletes', () async {
      final bloc = getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.status == LessonPlansStatus.loaded)));
      expect(bloc.state.plans.length, 6);
      bloc.add(const LessonMilestoneToggled('lp_1', 3));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.byId('lp_1')!.milestones[3].done)));
      bloc.add(LessonPlanSaved(bloc.state.byId('lp_2')!.copyWith(id: '', code: '', title: 'Copy plan')));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.plans.length == 7)));
      expect(bloc.state.plans.first.code, 'LP-P8-07');
      bloc.add(const LessonPlanDeleted('lp_6'));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.byId('lp_6') == null)));
      await bloc.close();
    });

    test('online tests bloc starts, ends, reuses and saves', () async {
      final bloc = getIt<OnlineTestsBloc>()..add(const OnlineTestsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<OnlineTestsState>((s) => s.status == OnlineTestsStatus.loaded)));
      bloc.add(const OnlineTestStarted('ts_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<OnlineTestsState>((s) => s.byId('ts_1')?.status == 'live')));
      bloc.add(const OnlineTestEnded('ts_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<OnlineTestsState>((s) => s.byId('ts_1')?.results?.submitted == 37)));
      bloc.add(const OnlineTestReused('ts_4'));
      await expectLater(bloc.stream, emitsThrough(predicate<OnlineTestsState>((s) => s.tests.length == 5 && s.tests.first.status == 'draft')));
      expect(bloc.state.tests.first.title, endsWith('(Copy)'));
      bloc.add(OnlineTestSaved(bloc.state.byId('ts_2')!.copyWith(title: 'Renamed'), publish: true));
      await expectLater(bloc.stream, emitsThrough(predicate<OnlineTestsState>((s) => s.byId('ts_2')?.title == 'Renamed')));
      expect(db.list('ts_notices'), isNotEmpty);
      await bloc.close();
    });

    test('certificates bloc signs pending and issues', () async {
      final bloc = getIt<CertificatesBloc>()..add(const CertificatesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<CertificatesState>((s) => s.loaded)));
      expect(bloc.state.templates.length, 12);
      expect(bloc.state.mine.length, 6);
      bloc.add(const CertificateSigned('cc_4'));
      await expectLater(bloc.stream, emitsThrough(predicate<CertificatesState>((s) => s.pendingCount == 3)));
      bloc.add(const PendingCertificatesSigned());
      await expectLater(bloc.stream, emitsThrough(predicate<CertificatesState>((s) => s.pendingCount == 0)));
      bloc.add(const CertificateRevoked('cc_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<CertificatesState>((s) => s.certificate('cc_1') == null)));
      await bloc.close();
    });
  });

  testWidgets('more hub shows pulse and routes', (t) async {
    await open(t, RoutePaths.more);
    expect(find.text("Today's Teaching Pulse"), findsOneWidget);
    expect(find.textContaining(RegExp(r'^\d+ Classes$')), findsOneWidget);
    expect(find.text('3 Active • 1 Draft Pending'), findsOneWidget);
    await t.enterText(find.byType(TextField).first, 'zzz');
    await t.pumpAndSettle();
    expect(find.text('No matching tools'), findsOneWidget);
    await t.enterText(find.byType(TextField).first, '');
    await t.pumpAndSettle();
    await t.tap(find.text('Lesson Plans'));
    await t.pumpAndSettle();
    expect(find.byTooltip('New lesson plan'), findsOneWidget);
  });

  testWidgets('lesson plans list, milestone, edit validation + create', (t) async {
    await open(t, RoutePaths.lessonPlans);
    expect(find.textContaining('Quadratic Equations'), findsWidgets);
    await see(t, find.text('Group Problem Solving Drill'));
    await t.tap(find.text('Group Problem Solving Drill'));
    await t.pumpAndSettle();
    expect((db.byId('ls_plans', 'lp_1')!['milestones'] as List)[3]['done'], true);
    await see(t, find.text('Edit Plan').first);
    await t.tap(find.text('Edit Plan').first);
    await t.pumpAndSettle();
    expect(find.text('Edit Lesson Plan'), findsWidgets);
    await t.tap(find.byTooltip('Back'));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('New lesson plan'));
    await t.pumpAndSettle();
    await t.tap(find.text('Save & Publish'));
    await t.pumpAndSettle();
    expect(find.textContaining('Enter a title'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Chapter 9 Circles');
    await see(t, find.text('Primary Learning Outcome'));
    await t.enterText(find.widgetWithText(TextFormField, 'Students will…'), 'Students will compute chord lengths.');
    await t.tap(find.text('Save & Publish'));
    await t.pumpAndSettle();
    expect(db.list('ls_plans').length, 7);
    expect(db.list('ls_plans').first['title'], 'Chapter 9 Circles');
    expect(find.text('Lesson Plans'), findsOneWidget);
  });

  testWidgets('lesson view shares and deletes', (t) async {
    await open(t, RoutePaths.lessonPlan('lp_1'));
    expect(find.text('Chapter 4: Quadratic Equations & Applications'), findsOneWidget);
    await see(t, find.text('Lesson Breakdown'));
    await t.tap(find.text('Share Plan'));
    await t.pumpAndSettle();
    expect(db.list('ls_shares'), isNotEmpty);
    await t.tap(find.byTooltip('Delete plan'));
    await t.pumpAndSettle();
    await t.tap(find.text('Delete'));
    await t.pumpAndSettle();
    expect(db.byId('ls_plans', 'lp_1'), isNull);
  });

  testWidgets('tests list actions and create', (t) async {
    await open(t, RoutePaths.tests);
    expect(find.text('Trigonometric Identities & Heights Review'), findsOneWidget);
    await t.tap(find.text('Start Now').first);
    await t.pumpAndSettle();
    expect(db.list('ts_tests').where((x) => x['status'] == 'live').length, 2);
    await t.tap(find.text('Create Test'));
    await t.pumpAndSettle();
    await t.tap(find.text('Finish'));
    await t.pumpAndSettle();
    expect(find.textContaining('Enter a title'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Unit Test 5');
    await see(t, find.text('Add Question to Section A'));
    await t.tap(find.text('Add Question to Section A'));
    await t.pumpAndSettle();
    final sheet = find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField));
    await t.enterText(sheet.at(0), '2+2?');
    await t.enterText(sheet.at(2), '4');
    await t.enterText(sheet.at(3), '5');
    await t.tap(find.text('Add Question'));
    await t.pumpAndSettle();
    expect(find.text('2+2?'), findsOneWidget);
    await t.tap(find.text('Save Draft'));
    await t.pumpAndSettle();
    expect(db.list('ts_tests').first['title'], 'Unit Test 5');
    expect(db.list('ts_tests').first['status'], 'draft');
    expect(db.list('ts_tests').first['nq'], 1);
  });

  testWidgets('edit test saves changes', (t) async {
    await open(t, RoutePaths.testEdit('ts_1'));
    expect(find.text('TEST-MATH10A-04'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Trig Review v2');
    await see(t, find.text('Schedule & Security Controls'));
    await t.tap(find.text('Save Changes'));
    await t.pumpAndSettle();
    expect(db.byId('ts_tests', 'ts_1')!['title'], 'Trig Review v2');
    expect(db.byId('ts_tests', 'ts_1')!['status'], 'upcoming');
  });

  testWidgets('certificates list signs pending and switches to mine', (t) async {
    await open(t, RoutePaths.certificates);
    expect(find.text('Dev Malhotra'), findsOneWidget);
    await t.tap(find.text('Sign Pending (4)'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sign & Issue'));
    await t.pumpAndSettle();
    expect(db.list('cr_certs').where((c) => c['status'] == 'pending'), isEmpty);
    await t.tap(find.text('My Certifications'));
    await t.pumpAndSettle();
    expect(find.text('Institutional Portfolio · 6 items'), findsOneWidget);
    await t.tap(find.text('Active / Verified (5)'));
    await t.pumpAndSettle();
    expect(find.text('Institutional Portfolio · 5 items'), findsOneWidget);
  });

  testWidgets('certificate detail signs a pending certificate', (t) async {
    await open(t, RoutePaths.certificate('cc_4'));
    expect(find.text('Certificate Details'), findsOneWidget);
    await see(t, find.text('AWARDED RECIPIENT'));
    expect(find.text('AWARDED RECIPIENT'), findsOneWidget);
    await t.tap(find.text('Sign & Issue'));
    await t.pumpAndSettle();
    expect(db.byId('cr_certs', 'cc_4')!['status'], 'issued');
  });

  testWidgets('issue certificate flow', (t) async {
    await open(t, RoutePaths.certificateIssue);
    await t.tap(find.text('Sign & Issue'));
    await t.pumpAndSettle();
    expect(find.text('Select a recipient'), findsOneWidget);
    await t.tap(find.byType(ListTile).first);
    await t.pumpAndSettle();
    await t.enterText(find.widgetWithText(TextFormField, 'e.g. Junior Mathematics Olympiad — 1st Place'), 'Academic Merit');
    await see(t, find.textContaining('CITATION'));
    await t.enterText(find.widgetWithText(TextFormField, 'In recognition of…'), 'For outstanding academic performance this term.');
    await t.tap(find.text('Sign & Issue'));
    await t.pumpAndSettle();
    expect(find.text('Certificate Preview'), findsOneWidget);
    await t.tap(find.text('Confirm & Issue'));
    await t.pumpAndSettle();
    expect(db.list('cr_certs').first['title'], 'Academic Merit');
    expect(db.list('cr_certs').length, 8);
  });

  testWidgets('templates filter and apply', (t) async {
    await open(t, RoutePaths.certificateTemplates);
    expect(find.textContaining('12 Official'), findsOneWidget);
    expect(find.text('Apply Template'), findsOneWidget);
    await t.tap(find.text('Portrait'));
    await t.pumpAndSettle();
    expect(find.text('Modern Minimalist'), findsNothing);
    expect(find.text('Excellence Ribbon'), findsWidgets);
  });
}
