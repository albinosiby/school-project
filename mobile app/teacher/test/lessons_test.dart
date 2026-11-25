import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/design_system/design_system.dart' show AppButton, AppTextField;
import 'package:teacher_app/config/routes/modules/lessons_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_bloc.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_events.dart';
import 'package:teacher_app/modules/lessons/bloc/certificates_states.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_bloc.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_events.dart';
import 'package:teacher_app/modules/lessons/bloc/lesson_plans_states.dart';
import 'package:teacher_app/modules/lessons/models/lesson_plan_models.dart';
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
      expect(bloc.state.summary.draftPlans, 2);
      expect(bloc.state.summary.upcomingTests, 2);
      expect(bloc.state.summary.pendingCertificates, 4);
      final unread = db.list('ms_messages').fold<int>(0, (a, m) => a + (m['unread'] as int? ?? 0));
      expect(bloc.state.summary.unreadMessages, unread);
      db.update('ts_tests', 'ts_1', {'status': 'live'});
      await expectLater(bloc.stream, emitsThrough(predicate<MoreState>((s) => s.summary.upcomingTests == 1)));
      await bloc.close();
    });

    test('lesson plans bloc: mark taught with a note, save, copy to a section, send for review, delete', () async {
      final bloc = getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.status == LessonPlansStatus.loaded)));
      expect(bloc.state.plans.length, 6);
      bloc.add(const LessonSessionMarked('lp_1', 's3', SessionStatus.taught, note: 'Ran out of time for pair practice'));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.byId('lp_1')!.sessions[2].taught)));
      expect(bloc.state.byId('lp_1')!.sessions[2].note, 'Ran out of time for pair practice');
      expect(bloc.state.byId('lp_1')!.taughtCount, 3);
      bloc.add(LessonPlanSaved(bloc.state.byId('lp_2')!.copyWith(id: '', code: '', title: 'Copy plan')));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.plans.length == 7)));
      bloc.add(const LessonPlanCopied('lp_1', cls: '10-A', classId: 'cls_10A'));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.plans.any((p) => p.copiedFrom == 'lp_1'))));
      final copy = bloc.state.plans.firstWhere((p) => p.copiedFrom == 'lp_1');
      expect((copy.cls, copy.draft, copy.taughtCount, copy.sessions.length), ('10-A', true, 0, 5));
      bloc.add(const LessonPlanReviewRequested('lp_3'));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.byId('lp_3')!.review.state == ReviewState.submitted)));
      bloc.add(const LessonPlanDeleted('lp_6'));
      await expectLater(bloc.stream, emitsThrough(predicate<LessonPlansState>((s) => s.byId('lp_6') == null)));
      await bloc.close();
    });

    test('old plans (milestones) read as sessions; dates come from the timetable', () {
      final old = LessonPlan.fromJson({
        'id': 'x', 'cls': '10-B', 'subject': 'Mathematics', 'title': 'Old', 'date': '2026-11-20', 'outcome': 'Solve quadratics',
        'milestones': [{'title': 'Formula', 'done': true}, {'title': 'Graphs', 'done': false}],
        'objectives': [{'title': 'Derive the formula'}],
      });
      expect([for (final s in old.sessions) (s.focus, s.status)], [('Formula', SessionStatus.taught), ('Graphs', SessionStatus.planned)]);
      expect(old.outcomes, ['Derive the formula', 'Solve quadratics']);
      // Mon P2 and Wed P4 from Thu 2026-11-20: next Mon, Wed, Mon
      final d = suggestSessionDates(periods: const [(day: 1, slot: 'P2'), (day: 3, slot: 'P4')], from: '2026-11-20', count: 3);
      expect(d.map((e) => '${e.date} ${e.slot}'), ['2026-11-23 P2', '2026-11-25 P4', '2026-11-30 P2']);
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

  testWidgets('more hub routes to tools', (t) async {
    await open(t, RoutePaths.more);
    expect(find.text('TEACHING'), findsOneWidget);
    expect(find.text('3 active'), findsOneWidget); // lesson plans count
    await t.tap(find.text('Lesson Plans'));
    await t.pumpAndSettle();
    expect(find.byTooltip('New lesson plan'), findsOneWidget);
  });

  testWidgets('lesson plans: today, list, edit validation + create', (t) async {
    await open(t, RoutePaths.lessonPlans);
    expect(find.text("TODAY'S LESSONS"), findsOneWidget);
    expect(find.text('Discriminant and nature of roots'), findsOneWidget);
    expect(find.text('Quadratic Equations'), findsWidgets);
    await t.tap(find.byTooltip('New lesson plan'));
    await t.pumpAndSettle();
    await t.tap(find.text('Save Plan'));
    await t.pumpAndSettle();
    expect(find.textContaining('Enter a title'), findsOneWidget);
    await t.enterText(find.descendant(of: find.widgetWithText(AppTextField, 'Title'), matching: find.byType(TextFormField)), 'Circles');
    await see(t, find.text('Add 1'));
    await t.tap(find.text('Add 1'));
    await t.pumpAndSettle();
    await t.tap(find.text('Save Plan'));
    await t.pumpAndSettle();
    expect(db.list('ls_plans').length, 7);
    expect(db.list('ls_plans').first['title'], 'Circles');
    expect((db.list('ls_plans').first['sessions'] as List).length, 1);
  });

  testWidgets('lesson view marks a session taught and deletes', (t) async {
    await open(t, RoutePaths.lessonPlan('lp_1'));
    expect(find.text('Quadratic Equations'), findsOneWidget);
    await see(t, find.text('Mark as taught'));
    await t.tap(find.text('Mark as taught').first);
    await t.pumpAndSettle();
    await t.enterText(find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextFormField)), 'Good pace');
    await t.tap(find.widgetWithText(AppButton, 'Mark as taught').last);
    await t.pumpAndSettle();
    final s3 = (db.byId('ls_plans', 'lp_1')!['sessions'] as List)[2] as Map;
    expect((s3['status'], s3['note']), ('taught', 'Good pace'));
    await t.tap(find.byTooltip('More'));
    await t.pumpAndSettle();
    await t.tap(find.text('Delete plan'));
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
    // the form keeps every field built now (validation of off-screen fields): tap the sheet's own button
    await t.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text('Add Question')));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('2+2?', skipOffstage: false));
    await t.pumpAndSettle();
    expect(find.text('2+2?'), findsOneWidget);
    // every field is validated now (it used to be skipped while scrolled away): the default cutoff 18 exceeds the
    // 1-mark total, so it must be brought within the total before the draft saves
    await t.tap(find.text('Save Draft'));
    await t.pumpAndSettle();
    expect(find.text('Max 1', skipOffstage: false), findsWidgets);
    final cutoff = find.descendant(of: find.widgetWithText(AppTextField, 'Pass cutoff (marks)', skipOffstage: false), matching: find.byType(TextFormField, skipOffstage: false));
    await t.ensureVisible(cutoff);
    await t.pumpAndSettle();
    await t.enterText(cutoff, '1');
    await t.pumpAndSettle();
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

  testWidgets('student certificates list signs pending', (t) async {
    await open(t, RoutePaths.certificates);
    expect(find.text('Student Certificates'), findsOneWidget);
    expect(find.text('Dev Malhotra'), findsOneWidget);
    await t.tap(find.text('Sign Pending (4)'));
    await t.pumpAndSettle();
    await t.tap(find.text('Sign & Issue'));
    await t.pumpAndSettle();
    expect(db.list('cr_certs').where((c) => c['status'] == 'pending'), isEmpty);
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
