import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/classes_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/classes/bloc/behaviour_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/behaviour_events.dart';
import 'package:teacher_app/modules/classes/bloc/behaviour_states.dart';
import 'package:teacher_app/modules/classes/bloc/classes_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/classes_events.dart';
import 'package:teacher_app/modules/classes/bloc/classes_states.dart';
import 'package:teacher_app/modules/classes/bloc/documents_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/documents_events.dart';
import 'package:teacher_app/modules/classes/bloc/documents_states.dart';
import 'package:teacher_app/modules/classes/bloc/new_homework_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/new_homework_events.dart';
import 'package:teacher_app/modules/classes/bloc/new_homework_states.dart';
import 'package:teacher_app/modules/classes/bloc/resources_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/resources_events.dart';
import 'package:teacher_app/modules/classes/bloc/resources_states.dart';
import 'package:teacher_app/modules/classes/bloc/students_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/students_events.dart';
import 'package:teacher_app/modules/classes/bloc/students_states.dart';
import 'package:teacher_app/modules/classes/models/classes_models.dart';
import 'package:teacher_app/modules/classes/screens/classes_screen.dart';
import 'package:teacher_app/modules/tasks/models/homework_models.dart';
import 'package:teacher_app/modules/tasks/repositories/homework_repository_interface.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

late LocalDatabaseService db;

/// The test font renders square glyphs, so overflow warnings are not meaningful here.
void _ignoreOverflow() {
  final old = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    old?.call(d);
  };
  addTearDown(() => FlutterError.onError = old);
}

Future<void> pump(WidgetTester t, String location) async {
  _ignoreOverflow();
  await pumpScreen(t, location: location, routes: [
    GoRoute(path: RoutePaths.classes, builder: (_, _) => const Scaffold(body: ClassesScreen())),
    GoRoute(path: RoutePaths.tasks, builder: (_, _) => const Scaffold(body: Text('TASKS'))),
    ...classesRoutes,
  ]);
}

Future<void> tapText(WidgetTester t, String text, {bool last = false}) async {
  final f = last ? find.text(text).last : find.text(text).first;
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

Future<void> toTop(WidgetTester t) async {
  await t.drag(find.byType(Scrollable).first, const Offset(0, 5000));
  await t.pumpAndSettle();
}

void main() {
  setUp(() async => db = await setUpTestApp());

  group('blocs', () {
    test('ClassesBloc loads summaries and changes pacing', () async {
      final bloc = getIt<ClassesBloc>()..add(const ClassesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<ClassesState>((s) => s.status == ClassesStatus.loaded && s.pacing.length == 4)));
      expect(bloc.state.resourceCount('cls_10B'), 12);
      bloc.add(const PacingChanged('cls_10B', 1));
      await expectLater(bloc.stream, emitsThrough(predicate<ClassesState>((s) => s.pacing['cls_10B']!.done == 15)));
      expect(db.byId('cl_pacing', 'cls_10B')!['done'], 15);
      await bloc.close();
    });

    test('BehaviourBloc adds, notifies and deletes logs and creates badges', () async {
      final bloc = getIt<BehaviourBloc>()..add(const BehaviourLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<BehaviourState>((s) => s.logs.length == 10)));
      bloc.add(const BehaviourLogAdded(
        BehaviourLog(studentId: 'stu_101', classId: 'cls_10B', kind: 'praise', badge: 'Peer Tutoring', context: 'X', note: 'Y', merits: 5, teacher: 'T', at: '2026-10-24T10:00:00', status: 'Logged'),
        studentName: 'Aarav',
      ));
      await expectLater(bloc.stream, emitsThrough(predicate<BehaviourState>((s) => s.savedSeq == 1 && s.notice == 'Log published for Aarav')));
      expect(db.list('cl_behaviour').length, 11);
      bloc.add(BehaviourParentNotified(BehaviourLog.fromJson(db.byId('cl_behaviour', 'bh3')!)));
      await expectLater(bloc.stream, emitsThrough(predicate<BehaviourState>((s) => s.notice == 'Parent notified')));
      expect(db.byId('cl_behaviour', 'bh3')!['status'], 'Parent notified');
      bloc.add(const BehaviourLogDeleted('bh3'));
      await expectLater(bloc.stream, emitsThrough(predicate<BehaviourState>((s) => s.logs.every((l) => l.id != 'bh3'))));
      bloc.add(const BehaviourBadgeCreated(BehaviourBadge(name: 'Thinker', kind: 'praise', category: 'Helping Hand', icon: 'idea', theme: 'Royal Violet', merits: 10, custom: true)));
      await expectLater(bloc.stream, emitsThrough(predicate<BehaviourState>((s) => s.badges.any((b) => b.name == 'Thinker'))));
      await bloc.close();
    });

    test('ResourcesBloc uploads, pins, deletes and toggles portal', () async {
      final bloc = getIt<ResourcesBloc>()..add(const ResourcesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.length == 12)));
      bloc.add(const ResourceUploaded(classId: 'cls_10B', fileName: 'Chapter 5.docx', category: 'Worksheets'));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.any((r) => r.title == 'Chapter 5.docx' && r.ext == 'docx'))));
      final r = bloc.state.resources.firstWhere((r) => r.id == 'rs3');
      bloc.add(ResourcePinToggled(r));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.firstWhere((x) => x.id == 'rs3').pinned)));
      bloc.add(ResourceDeleted(r));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.every((x) => x.id != 'rs3'))));
      bloc.add(const PortalVisibilityChanged(false));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => !s.portalVisible)));
      expect(db.doc('cl_prefs')['portalVisible'], false);
      await bloc.close();
    });

    test('StudentsBloc loads logs and records exports and calls', () async {
      final bloc = getIt<StudentsBloc>()..add(const StudentsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<StudentsState>((s) => s.status == StudentsStatus.loaded && s.logs.isNotEmpty)));
      bloc.add(const StudentsExportRequested('cls_10B', 42));
      await expectLater(bloc.stream, emitsThrough(predicate<StudentsState>((s) => s.notice!.contains('42 students'))));
      bloc.add(const GuardianCalled(studentId: 'stu_101', name: 'Mr. X', phone: '1'));
      await expectLater(bloc.stream, emitsThrough(predicate<StudentsState>((s) => s.notice == 'Calling Mr. X • 1')));
      expect(db.list('cl_exports').length, 1);
      expect(db.list('cl_contacts').length, 1);
      await bloc.close();
    });

    test('DocumentsBloc requests, receives and cancels', () async {
      final bloc = getIt<DocumentsBloc>()..add(const DocumentsLoadRequested('stu_102'));
      await expectLater(bloc.stream, emitsThrough(predicate<DocumentsState>((s) => s.status == DocumentsStatus.loaded && s.requests.length == 1)));
      bloc.add(DocumentRequestReceived(bloc.state.requests.first));
      await expectLater(bloc.stream, emitsThrough(predicate<DocumentsState>((s) => s.requests.isEmpty && s.documents.length == 3)));
      bloc.add(const DocumentRequested(DocumentRequest(studentId: 'stu_102', doc: 'Birth Certificate', due: '2026-11-10', createdAt: '2026-10-24')));
      await expectLater(bloc.stream, emitsThrough(predicate<DocumentsState>((s) => s.requests.length == 1)));
      bloc.add(DocumentRequestCancelled(bloc.state.requests.first.id));
      await expectLater(bloc.stream, emitsThrough(predicate<DocumentsState>((s) => s.requests.isEmpty)));
      await bloc.close();
    });

    test('NewHomeworkBloc creates homework through IHomeworkRepository', () async {
      final bloc = getIt<NewHomeworkBloc>()..add(const NewHomeworkLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<NewHomeworkState>((s) => s.status == NewHomeworkStatus.ready)));
      final before = bloc.state.countFor('cls_8C');
      bloc.add(const NewHomeworkSubmitted(
        Homework(id: '', classId: 'cls_8C', title: 'Draft', subject: 'Physics', due: '2026-11-01', maxMarks: 10, status: 'draft', createdAt: '2026-10-24', extra: {'code': 'HW-PHYS-8C-01'}),
        enrolled: 40,
      ));
      await expectLater(bloc.stream, emitsThrough(predicate<NewHomeworkState>((s) => s.status == NewHomeworkStatus.saved && s.message == 'Draft saved')));
      final all = await getIt<IHomeworkRepository>().getAll(classId: 'cls_8C');
      expect(all.length, before + 1);
      final hw = all.firstWhere((h) => h.title == 'Draft');
      expect(hw.status, 'draft');
      expect(hw.extra['code'], 'HW-PHYS-8C-01');
      expect(hw.submissions.length, 40);
      await bloc.close();
    });
  });

  group('screens', () {
    testWidgets('classes tab shows cards, hub, roster, pacing and search', (t) async {
      await getIt<IHomeworkRepository>().create(Homework(
        id: '', classId: 'cls_10B', title: 'Quadratic Equations – Set 4', subject: 'Math',
        due: DateTime.now().add(const Duration(days: 30)).toIso8601String().substring(0, 10), maxMarks: 20, createdAt: DateTime.now().toIso8601String(),
        submissions: {for (var i = 1; i <= 42; i++) 'stu_${100 + i}': Submission(status: i <= 34 ? SubmissionStatus.submitted : SubmissionStatus.pending)},
      ));
      await pump(t, RoutePaths.classes);
      expect(find.text('My Classes & Sections'), findsOneWidget);
      expect(find.text('168 total', findRichText: true), findsOneWidget);
      expect(find.textContaining('Mathematics'), findsWidgets);
      await t.scrollUntilVisible(find.text('Syllabus Pacing'), 300, scrollable: find.byType(Scrollable).first);
      await t.pumpAndSettle();
      await t.tap(find.text('Syllabus Pacing'));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('More topics'));
      await t.pumpAndSettle();
      expect(db.byId('cl_pacing', 'cls_10B')!['done'], 15);
      await tapText(t, 'Done');
      await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField).first, 'physics');
      await t.pumpAndSettle();
      expect(find.text('Mathematics • Section B'), findsNothing);
      expect(find.textContaining('Physics'), findsWidgets);
    });

    testWidgets('class card shows active homework progress', (t) async {
      final hws = await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B');
      for (final h in hws) {
        await getIt<IHomeworkRepository>().delete(h.id);
      }
      await getIt<IHomeworkRepository>().create(Homework(
        id: '', classId: 'cls_10B', title: 'Set 4', subject: 'Math', due: DateTime.now().add(const Duration(days: 1)).toIso8601String().substring(0, 10),
        maxMarks: 20, createdAt: DateTime.now().toIso8601String(),
        submissions: {for (var i = 1; i <= 42; i++) 'stu_${100 + i}': Submission(status: i <= 34 ? SubmissionStatus.submitted : SubmissionStatus.pending)},
      ));
      await pump(t, RoutePaths.classes);
      expect(find.textContaining('34 / 42 Students Submitted'), findsOneWidget);
      expect(find.textContaining('Due Tomorrow'), findsOneWidget);
    });

    testWidgets('behaviour list, filter and new log publish', (t) async {
      await pump(t, RoutePaths.behaviour);
      expect(find.text('Weekly Conduct Pulse'), findsOneWidget);
      expect(find.textContaining('Aarav Sharma', findRichText: true), findsOneWidget);
      await tapText(t, 'Guidance Flags (2)');
      expect(find.textContaining('Aarav Sharma', findRichText: true), findsNothing);
      expect(find.text('Homework Discrepancy'), findsWidgets);
      await t.drag(find.byType(Scrollable).first, const Offset(0, 800));
      await t.pumpAndSettle();
      await tapText(t, 'New Log');
      expect(find.text('Quick Switch Recent:'), findsOneWidget);
      await t.tap(find.text('Publish'));
      await t.pumpAndSettle();
      expect(find.text('Select a badge'), findsWidgets);
      final before = db.list('cl_behaviour').length;
      await tapText(t, 'Peer Tutoring');
      await t.enterText(find.byType(TextField).at(1), 'Helped classmates.');
      await t.pump();
      await t.tap(find.text('Publish'));
      await t.pumpAndSettle();
      expect(db.list('cl_behaviour').length, before + 1);
      expect(find.text('Weekly Conduct Pulse'), findsOneWidget); // popped back
    });

    testWidgets('custom badge sheet creates badge', (t) async {
      await pump(t, RoutePaths.behaviourNew);
      await tapText(t, 'Custom Badge');
      expect(find.text('Create Custom Badge'), findsOneWidget);
      await tapText(t, 'Create & Apply Badge');
      expect(find.text('Enter a badge name'), findsOneWidget);
      await t.enterText(find.widgetWithText(TextField, 'e.g. Inquisitive Thinker'), 'Inquisitive Thinker');
      await tapText(t, 'Create & Apply Badge');
      expect(db.list('cl_badges').any((b) => b['name'] == 'Inquisitive Thinker' && b['custom'] == true), isTrue);
      await toTop(t);
      expect(find.text('1 Selected'), findsOneWidget);
    });

    testWidgets('shared resources list, upload and delete', (t) async {
      await pump(t, RoutePaths.resources);
      expect(find.text('12 Shared Files'), findsOneWidget);
      expect(find.text('Pinned Handouts'), findsOneWidget);
      await tapText(t, 'Upload Resource');
      await tapText(t, 'Upload', last: true);
      expect(find.text('Enter a file name'), findsOneWidget);
      await t.enterText(find.widgetWithText(TextFormField, 'e.g. Chapter 5 Worksheet.pdf'), 'Chapter 5 Worksheet.pdf');
      await tapText(t, 'Upload', last: true);
      expect(db.list('cl_resources').length, 13);
      await toTop(t);
      expect(find.text('13 Shared Files'), findsOneWidget);
      db.remove('cl_resources', db.list('cl_resources').first['id'] as String);
      await t.pumpAndSettle();
      expect(find.text('12 Shared Files'), findsOneWidget);
    });

    testWidgets('students list search and profile tabs', (t) async {
      await pump(t, '${RoutePaths.students}?classId=cls_10B');
      expect(find.textContaining('Directory'), findsOneWidget);
      expect(find.text('All (42)'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'Aarav');
      await t.pumpAndSettle();
      expect(find.text('Aarav Sharma'), findsWidgets);
      await tapText(t, 'Aarav Sharma');
      expect(find.text('Academic Mastery'), findsOneWidget);
      expect(find.text('Guardian & Emergency Info'), findsOneWidget);
      await tapText(t, 'Academics', last: true);
      expect(find.text('Benchmark Comparison'), findsOneWidget);
      await tapText(t, 'Attendance', last: true);
      expect(find.text('November 2024'), findsOneWidget);
    });

    testWidgets('students list honours ?q=', (t) async {
      await pump(t, '${RoutePaths.students}?classId=cls_10B&q=Aarav');
      expect(find.text('Aarav Sharma'), findsWidgets);
      expect(find.textContaining('Ananya'), findsNothing);
    });

    testWidgets('documents and request document sheet', (t) async {
      await pump(t, RoutePaths.studentDocuments('stu_101'));
      expect(find.text('STUDENT VAULT'), findsOneWidget);
      expect(find.text('Aadhaar Card (UIDAI Verified)'), findsOneWidget);
      await t.tap(find.text('Request Document'));
      await t.pumpAndSettle();
      await tapText(t, 'Send Request');
      expect(db.list('cl_doc_requests').where((r) => r['studentId'] == 'stu_101').length, 1);
      expect(find.text('PENDING REQUESTS'), findsOneWidget);
    });

    testWidgets('new homework validates and publishes via the homework repository', (t) async {
      final before = (await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).length;
      await pump(t, '${RoutePaths.homeworkNew}?classId=cls_10B');
      expect(find.text('NEW HOMEWORK'), findsOneWidget);
      await t.tap(find.text('Publish HW'));
      await t.pumpAndSettle();
      expect(find.text('Enter an assignment title'), findsOneWidget);
      await t.enterText(find.widgetWithText(TextField, 'e.g. Quadratic Equations — Practice Set 5'), 'Practice Set 5');
      await t.pump();
      await t.tap(find.text('Publish HW'));
      await t.pumpAndSettle();
      final hw = (await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).firstWhere((h) => h.title == 'Practice Set 5');
      expect((await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).length, before + 1);
      expect(hw.status, 'open');
      expect(hw.submissions.length, 42);
      expect(hw.submissions['stu_101']!.status, SubmissionStatus.pending);
      expect('${hw.extra['code']}', startsWith('HW-MATH-10B-'));
    });
  });
}
