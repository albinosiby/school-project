import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/classes_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/design_system/design_system.dart' show AppSegmented;
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:teacher_app/modules/attendance/models/attendance_models.dart' show AttendanceRecord, dkey, todayDate;
import 'package:teacher_app/modules/school/models/school_models.dart';
import 'package:teacher_app/modules/classes/models/class_management_models.dart';
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
import 'package:teacher_app/modules/classes/bloc/class_management_bloc.dart';
import 'package:teacher_app/modules/classes/bloc/class_management_events.dart';
import 'package:teacher_app/modules/classes/bloc/class_management_states.dart';
import 'package:teacher_app/modules/classes/models/classes_models.dart';
import 'package:teacher_app/modules/classes/screens/widgets/class_charts.dart';
import 'package:teacher_app/modules/classes/screens/classes_screen.dart';
import 'package:teacher_app/modules/school/repositories/school_repository_interface.dart';
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

/// Taps the profile tab [label] (in the segmented control, not a card title).
Future<void> tab(WidgetTester t, String label) async {
  await t.tap(find.descendant(of: find.byType(AppSegmented), matching: find.text(label)));
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

    test('ResourcesBloc adds a YouTube video and a Drive link, shares, pins and deletes', () async {
      final bloc = getIt<ResourcesBloc>()..add(const ResourcesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.length == 12)));
      bloc.add(ResourceAdded(SharedResource(classId: 'cls_10B', title: 'Fractions explained', kind: ResourceKind.youtube, url: 'https://youtu.be/abcDEF12345', visibility: 'parents', createdAt: DateTime.now().toIso8601String())));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.any((r) => r.title == 'Fractions explained'))));
      final video = bloc.state.resources.firstWhere((r) => r.title == 'Fractions explained');
      expect(video.videoId, 'abcDEF12345');
      expect(video.forParents, isTrue);
      bloc.add(const ResourceAdded(SharedResource(classId: 'cls_10B', title: 'Notes folder', kind: ResourceKind.link, url: 'https://drive.google.com/drive/folders/xyz')));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.any((r) => r.title == 'Notes folder' && r.isDrive && !r.forParents))));
      final drive = bloc.state.resources.firstWhere((r) => r.title == 'Notes folder');
      bloc.add(ResourceVisibilityToggled(drive));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.firstWhere((x) => x.id == drive.id).forParents)));
      final r = bloc.state.resources.firstWhere((r) => r.id == 'rs3');
      bloc.add(ResourcePinToggled(r));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.firstWhere((x) => x.id == 'rs3').pinned)));
      bloc.add(ResourceDeleted(r));
      await expectLater(bloc.stream, emitsThrough(predicate<ResourcesState>((s) => s.resources.every((x) => x.id != 'rs3'))));
      await bloc.close();
    });

    test('youtube ids and resource types', () {
      for (final u in ['https://youtu.be/abcDEF12345', 'https://www.youtube.com/watch?v=abcDEF12345&t=3', 'https://youtube.com/shorts/abcDEF12345', 'https://m.youtube.com/embed/abcDEF12345']) {
        expect(youtubeId(u), 'abcDEF12345', reason: u);
      }
      expect(youtubeId('https://vimeo.com/123'), isNull);
      expect(isDriveLink('https://docs.google.com/presentation/d/1/edit'), isTrue);
      expect(const SharedResource(classId: 'c', title: 't', fileName: 'Chapter 5.pptx').fileType, 'ppt');
      expect(const SharedResource(classId: 'c', title: 't', fileName: 'a.docx').fileType, 'doc');
      expect(SharedResource.fromJson({'classId': 'c', 'title': 'Old', 'ext': 'pdf', 'sizeKb': 2}).visibility, 'private', reason: 'older rows stay private');
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
      await expectLater(bloc.stream, emitsThrough(predicate<NewHomeworkState>((s) => s.status == NewHomeworkStatus.saved)));
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
    testWidgets('classes tab: the class teacher card on top, subject classes below with open homework', (t) async {
      final other = (await getIt<ISchoolRepository>().getClasses()).firstWhere((c) => !c.classTeacher);
      await getIt<IHomeworkRepository>().create(Homework(
        id: '', classId: other.id, title: 'Probe worksheet', subject: 'Math', due: DateTime.now().add(const Duration(days: 1)).toIso8601String().substring(0, 10),
        maxMarks: 20, createdAt: DateTime.now().toIso8601String(),
        submissions: {for (var i = 1; i <= 10; i++) 'stu_x$i': Submission(status: i <= 7 ? SubmissionStatus.submitted : SubmissionStatus.pending)},
      ));
      await pump(t, RoutePaths.classes);
      expect(find.byKey(const ValueKey('my-class-cls_10B')), findsOneWidget);
      expect(find.text('CLASS TEACHER'), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('my-class-cls_10B')), matching: find.text('Class 10-B')), findsOneWidget);
      expect(find.byKey(ValueKey('teach-class-${other.id}')), findsOneWidget);
      // her own class is also listed under the subjects she teaches (independent of class management)
      final own = (await getIt<ISchoolRepository>().getClasses()).firstWhere((c) => c.id == 'cls_10B');
      expect(find.byKey(const ValueKey('teach-class-cls_10B')), own.subjectNames.isNotEmpty || own.subject.isNotEmpty ? findsOneWidget : findsNothing);
      await t.scrollUntilVisible(find.textContaining('Probe worksheet'), 300, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('7/10 turned in'), findsOneWidget);
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

    testWidgets('resources: add a YouTube video for parents, filter, make it private', (t) async {
      await pump(t, '${RoutePaths.resources}?classId=cls_10B');
      expect(find.text('Resources'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('res-add')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('res-type-youtube')));
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const ValueKey('res-url')), 'not a link');
      await t.enterText(find.byKey(const ValueKey('res-title')), 'Photosynthesis');
      await t.tap(find.byKey(const ValueKey('res-save')));
      await t.pumpAndSettle();
      expect(find.textContaining('Paste a YouTube video link'), findsOneWidget);
      await t.enterText(find.byKey(const ValueKey('res-url')), 'https://youtu.be/abcDEF12345');
      await t.pump();
      await t.ensureVisible(find.byKey(const ValueKey('res-save')));
      await t.tap(find.byKey(const ValueKey('res-save')));
      await t.pumpAndSettle();
      final row = db.list('cl_resources').firstWhere((r) => r['title'] == 'Photosynthesis');
      expect(row['kind'], 'youtube');
      expect(row['visibility'], 'parents');
      await t.tap(find.textContaining('Videos ('));
      await t.pumpAndSettle();
      expect(find.text('Photosynthesis'), findsOneWidget);
      await t.tap(find.byKey(ValueKey('res-vis-${row['id']}')));
      await t.pumpAndSettle();
      expect(db.byId('cl_resources', '${row['id']}')!['visibility'], 'private');
    });

    testWidgets('class page: class teacher tools, search and the student profile with editable details', (t) async {
      await pump(t, '${RoutePaths.students}?classId=cls_10B');
      expect(find.text('You are the class teacher'), findsOneWidget);
      await t.scrollUntilVisible(find.textContaining('All (42)'), 300, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('All (42)'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'Aarav');
      await t.pumpAndSettle();
      await t.scrollUntilVisible(find.byKey(const ValueKey('student-row-stu_101')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(const ValueKey('student-row-stu_101')), findsOneWidget);
      expect(find.byKey(const ValueKey('student-row-stu_102')), findsNothing);
      await t.tap(find.byKey(const ValueKey('student-row-stu_101')));
      await t.pumpAndSettle();
      for (final tab in ['Overview', 'Attendance', 'Academics', 'Details']) {
        expect(find.text(tab), findsWidgets);
      }
      await tab(t, 'Attendance');
      expect(find.text('This year'), findsOneWidget);
      await tab(t, 'Details');
      expect(find.text('Parents & contacts'), findsOneWidget);
      expect(find.text('Mr. Sharma'), findsWidgets);
      // the class teacher corrects the health notes
      await t.ensureVisible(find.byKey(const ValueKey('edit-Health')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('edit-Health')));
      await t.pumpAndSettle();
      await t.tap(find.text('O+'));
      await t.enterText(find.byKey(const ValueKey('medical-conditions')), 'Asthma — carries an inhaler');
      await t.tap(find.byKey(const ValueKey('details-save')));
      await t.pumpAndSettle();
      final saved = db.byId('student_details', 'stu_101')!;
      expect(saved['conditions'], 'Asthma — carries an inhaler');
      expect(saved['bloodGroup'], 'O+');
      expect(find.text('Asthma — carries an inhaler'), findsWidgets);
    });

    testWidgets('attendance calendar: one dot per period, red where absent, and the day sheet names the subjects', (t) async {
      final repo = getIt<IAttendanceRepository>();
      final day = dkey(todayDate());
      await repo.saveRecord(AttendanceRecord(id: 'cal1', classId: 'cls_10B', date: day, period: 1, total: 42, submitted: true));
      await repo.saveRecord(AttendanceRecord(id: 'cal2', classId: 'cls_10B', date: day, period: 2, total: 42, marks: const {'stu_101': 'A'}, submitted: true));
      await pump(t, RoutePaths.student('stu_101'));
      await tab(t, 'Attendance');
      final cell = find.byKey(ValueKey('cal-day-$day'));
      await t.ensureVisible(cell);
      await t.pumpAndSettle();
      expect(find.bySemanticsLabel(RegExp('$day, absent in 1 periods')), findsOneWidget);
      await t.tap(cell);
      await t.pumpAndSettle();
      expect(find.textContaining('Absent in 1 of'), findsOneWidget);
      expect(find.text('P1'), findsOneWidget);
      expect(find.text('P2'), findsOneWidget);
      expect(find.text('Absent'), findsWidgets);
      expect(find.text('Present'), findsWidgets);
    });

    testWidgets('class teacher changes the primary contact; the roster follows', (t) async {
      await pump(t, RoutePaths.student('stu_101'));
      await tab(t, 'Details');
      await t.tap(find.byKey(const ValueKey('edit-Parents & contacts')));
      await t.pumpAndSettle();
      await t.tap(find.text('Mother'));
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const ValueKey('contact-mother-name')), 'Mrs. Priya Sharma');
      await t.enterText(find.byKey(const ValueKey('contact-mother-phone')), '+91 9810010001');
      await t.tap(find.byKey(const ValueKey('details-save')));
      await t.pumpAndSettle();
      expect(db.byId('student_details', 'stu_101')!['contacts']['mother']['name'], 'Mrs. Priya Sharma');
    });

    testWidgets('a subject teacher sees no Details tab', (t) async {
      final other = (await getIt<ISchoolRepository>().getClasses()).firstWhere((c) => !c.classTeacher);
      final st = (await getIt<ISchoolRepository>().getStudents(classId: other.id)).first;
      await pump(t, RoutePaths.student(st.id));
      expect(find.text('Overview'), findsWidgets);
      expect(find.text('Details'), findsNothing);
      expect(find.text('Your class'), findsNothing);
    });

    testWidgets('class management opens from the class teacher card and shows performance charts', (t) async {
      await pump(t, RoutePaths.classes);
      await t.tap(find.byKey(const ValueKey('my-class-cls_10B')));
      await t.pumpAndSettle();
      expect(find.text('CLASS PERFORMANCE'), findsOneWidget);
      expect(find.text('Attendance trend'), findsOneWidget);
      expect(find.byType(TrendLineChart), findsWidgets);
      for (final tab in ['Overview', 'Students', 'Attendance']) {
        expect(find.textContaining(tab), findsWidgets);
      }
      // students tab lists every student with attendance and marks
      await t.tap(find.text('Students').first);
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('standing-stu_101')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('standing-stu_101')));
      await t.pumpAndSettle();
      expect(find.text('Attendance by subject'), findsOneWidget);
      expect(find.text('Full profile'), findsOneWidget);
    });

    testWidgets('class management: attendance history opens a day; a leave request is approved with a note', (t) async {
      await pump(t, '${RoutePaths.classManage('cls_10B')}?tab=attendance');
      expect(find.text('Recent registers'), findsOneWidget);
      await pump(t, '${RoutePaths.classManage('cls_10B')}?tab=leaves');
      expect(find.byKey(const ValueKey('leave-ls_1')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('approve-ls_1')));
      await t.pumpAndSettle();
      await t.enterText(find.byKey(const ValueKey('leave-note')), 'Get well soon');
      await t.tap(find.byKey(const ValueKey('leave-confirm')));
      await t.pumpAndSettle();
      final slip = db.byId('att_slips', 'ls_1')!;
      expect(slip['status'], 'Approved');
      expect(slip['decisionNote'], 'Get well soon');
      expect(find.byKey(const ValueKey('approve-ls_1')), findsNothing);
    });

    test('every timetable subject is listed, also those with no register or mark yet', () {
      const st = Student(id: 's1', name: 'A', roll: 1, classId: 'c', adm: '', guardian: '', phone: '', attendance: 0, grade: '');
      final s = ClassManagementState(
        status: ClassManagementStatus.loaded,
        classId: 'c',
        roster: const [st],
        timetable: const [
          ClassPeriod(classId: 'c', day: 1, period: 1, subject: 'Maths'),
          ClassPeriod(classId: 'c', day: 2, period: 1, subject: 'Maths'),
          ClassPeriod(classId: 'c', day: 1, period: 2, subject: 'Hindi'),
          ClassPeriod(classId: 'c', day: 1, period: 3, subject: 'Art'),
        ],
        // a Monday register of period 1 (Maths) with the student absent
        records: const [AttendanceRecord(id: 'r', classId: 'c', date: '2026-11-23', period: 1, total: 1, marks: {'s1': 'A'}, submitted: true)],
        marks: const [ClassMark(studentId: 's1', subject: 'Hindi', exam: 'Unit 1', cycleId: 'u1', score: 18, max: 20)],
      );
      expect(s.subjects, ['Maths', 'Art', 'Hindi']);
      expect(s.subjectAttendance, {'Maths': 0.0, 'Art': null, 'Hindi': null});
      expect(s.subjectMarks, {'Maths': null, 'Art': null, 'Hindi': 90.0});
      expect(s.weeklyPeriods('Maths'), 2);
      final mine = s.studentSubjectAttendance(st);
      expect(mine.keys, ['Maths', 'Art', 'Hindi']);
      expect(mine['Maths'], (attended: 0, total: 1));
      expect(mine['Art'], (attended: 0, total: 0));
    });

    test('a day combines every period (all subjects) for the trend and each student', () {
      const a = Student(id: 'a', name: 'A', roll: 1, classId: 'c', adm: '', guardian: '', phone: '', attendance: 0, grade: '');
      const b = Student(id: 'b', name: 'B', roll: 2, classId: 'c', adm: '', guardian: '', phone: '', attendance: 0, grade: '');
      final s = ClassManagementState(
        status: ClassManagementStatus.loaded,
        classId: 'c',
        roster: const [a, b],
        records: const [
          // Monday: period 1 everyone present, period 2 'a' absent
          AttendanceRecord(id: '1', classId: 'c', date: '2026-11-23', period: 1, total: 2, submitted: true),
          AttendanceRecord(id: '2', classId: 'c', date: '2026-11-23', period: 2, total: 2, marks: {'a': 'A'}, submitted: true),
          AttendanceRecord(id: '3', classId: 'c', date: '2026-11-24', period: 1, total: 2, submitted: true),
        ],
      );
      expect(s.days.length, 2);
      expect(s.days.first.periods, 2);
      expect(s.days.first.rate, 75);
      expect(s.days.first.absentees, {'a'});
      expect(s.markedLabel(s.days.first), '2 periods marked');
      expect(s.attendanceRate, closeTo(83.3, .1));
      expect(s.standingOf('a')!.attendance, closeTo(66.7, .1));
      expect(s.standingOf('a')!.absences, 1);
      expect(s.standingOf('b')!.attendance, 100);
    });

    test('class management bloc: subject attendance from the timetable and marks averages', () async {
      final bloc = getIt<ClassManagementBloc>()..add(const ClassManagementLoadRequested('cls_10B'));
      await expectLater(bloc.stream, emitsThrough(predicate<ClassManagementState>((s) => s.status == ClassManagementStatus.loaded)));
      final s = bloc.state;
      expect(s.roster.length, 42);
      expect(s.standings.length, 42);
      for (final r in s.records) {
        expect(s.subjectOf(r), isNotEmpty);
      }
      final bands = s.marksBands;
      expect(bands.fold<int>(0, (a, b) => a + b), s.standings.where((x) => x.marks != null).length);
      await bloc.close();
    });

    testWidgets('the subject view of the own class has no class-teacher tools', (t) async {
      await pump(t, '${RoutePaths.students}?classId=cls_10B&view=subject');
      expect(find.text('You are the class teacher'), findsNothing);
      expect(find.text('Needs your attention'), findsNothing);
      await t.scrollUntilVisible(find.textContaining('All (42)'), 300, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('All (42)'), findsOneWidget);
    });

    testWidgets('class page honours ?q=', (t) async {
      await pump(t, '${RoutePaths.students}?classId=cls_10B&q=Aarav');
      await t.scrollUntilVisible(find.byKey(const ValueKey('student-row-stu_101')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(const ValueKey('student-row-stu_101')), findsOneWidget);
      expect(find.byKey(const ValueKey('student-row-stu_102')), findsNothing);
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

    testWidgets('new homework validates, sets it for the class and opens it', (t) async {
      final before = (await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).length;
      await pump(t, '${RoutePaths.homeworkNew}?classId=cls_10B');
      expect(find.text('New assignment'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('hw-submit')));
      await t.pumpAndSettle();
      expect(find.textContaining('Give the assignment a title'), findsWidgets);
      await t.enterText(find.byKey(const ValueKey('hw-title')), 'Practice Set 5');
      await t.enterText(find.byKey(const ValueKey('hw-notes')), 'Exercise 4.2, questions 1-10');
      await t.pump();
      await t.tap(find.byKey(const ValueKey('hw-submit')));
      await t.pumpAndSettle();
      final all = await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B');
      final hw = all.firstWhere((h) => h.title == 'Practice Set 5');
      expect(all.length, before + 1);
      expect(hw.status, 'open');
      expect(hw.maxMarks, 10);
      expect(hw.description, 'Exercise 4.2, questions 1-10');
      expect(hw.submissions.length, 42);
      expect(hw.submissions['stu_101']!.status, SubmissionStatus.pending);
    });

    testWidgets('homework can be scheduled for later', (t) async {
      await pump(t, '${RoutePaths.homeworkNew}?classId=cls_10B');
      await t.enterText(find.byKey(const ValueKey('hw-title')), 'Chapter 6 questions');
      await t.tap(find.text('Schedule'));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('hw-publish-at')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('hw-submit')));
      await t.pumpAndSettle();
      final hw = (await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).firstWhere((h) => h.title == 'Chapter 6 questions');
      expect(hw.status, 'scheduled');
      expect(DateTime.parse('${hw.extra['publishAt']}').isAfter(DateTime.now()), isTrue);
    });

    testWidgets('a not-graded homework is set with 0 marks', (t) async {
      await pump(t, '${RoutePaths.homeworkNew}?classId=cls_10B');
      await t.enterText(find.byKey(const ValueKey('hw-title')), 'Read chapter 5');
      await t.dragUntilVisible(find.byKey(const ValueKey('hw-graded')), find.byType(ListView).first, const Offset(0, -250));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('hw-graded')));
      await t.pump();
      await t.tap(find.byKey(const ValueKey('hw-submit')));
      await t.pumpAndSettle();
      final hw = (await getIt<IHomeworkRepository>().getAll(classId: 'cls_10B')).firstWhere((h) => h.title == 'Read chapter 5');
      expect(hw.maxMarks, 0);
    });
  });
}
