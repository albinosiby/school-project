import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/tasks_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/tasks/bloc/duties_bloc.dart';
import 'package:teacher_app/modules/tasks/bloc/duties_events.dart';
import 'package:teacher_app/modules/tasks/bloc/duties_states.dart';
import 'package:teacher_app/modules/tasks/bloc/homework_bloc.dart';
import 'package:teacher_app/modules/tasks/bloc/homework_events.dart';
import 'package:teacher_app/modules/tasks/bloc/homework_states.dart';
import 'package:teacher_app/modules/tasks/bloc/syllabus_bloc.dart';
import 'package:teacher_app/modules/tasks/bloc/syllabus_events.dart';
import 'package:teacher_app/modules/tasks/bloc/syllabus_states.dart';
import 'package:teacher_app/modules/tasks/bloc/task_form_bloc.dart';
import 'package:teacher_app/modules/tasks/bloc/task_form_events.dart';
import 'package:teacher_app/modules/tasks/bloc/task_form_states.dart';
import 'package:teacher_app/modules/tasks/bloc/tasks_bloc.dart';
import 'package:teacher_app/modules/tasks/bloc/tasks_events.dart';
import 'package:teacher_app/modules/tasks/bloc/tasks_states.dart';
import 'package:teacher_app/modules/tasks/models/duty_models.dart';
import 'package:teacher_app/modules/tasks/models/homework_grading.dart';
import 'package:teacher_app/modules/tasks/models/task_models.dart';
import 'package:teacher_app/modules/tasks/screens/tasks_screen.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

/// The test environment has no Inter font (wider fallback glyphs), so layout overflows are ignored here.
void ignoreOverflow() {
  final orig = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    orig?.call(d);
  };
  addTearDown(() => FlutterError.onError = orig);
}

Finder vScroll() => find.byWidgetPredicate((w) => w is Scrollable && w.axis == Axis.vertical).last;

Future<void> tapV(WidgetTester t, Finder f, {int which = 0}) async {
  for (var i = 0; i < 25 && f.evaluate().length <= which; i++) {
    await t.drag(vScroll(), const Offset(0, -300));
    await t.pumpAndSettle();
  }
  final target = f.at(which);
  await t.ensureVisible(target);
  await t.pumpAndSettle();
  await t.tap(target);
  await t.pumpAndSettle();
}

Future<void> pump(WidgetTester t, String location) async {
  ignoreOverflow();
  await pumpScreen(t, location: location, routes: [
    GoRoute(path: RoutePaths.tasks, builder: (_, _) => const Scaffold(body: TasksScreen())),
    GoRoute(path: RoutePaths.notifications, builder: (_, _) => const Scaffold()),
    GoRoute(path: RoutePaths.profile, builder: (_, _) => const Scaffold()),
    ...tasksRoutes,
  ]);
}

void main() {
  late LocalDatabaseService db;
  setUp(() async => db = await setUpTestApp());

  group('blocs', () {
    test('tasks bloc loads counts and toggles done', () async {
      final bloc = getIt<TasksBloc>()..add(const TasksLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<TasksState>((s) => s.status == TasksStatus.loaded)));
      expect(bloc.state.open.length, 12);
      expect(bloc.state.done.length, 23);
      expect(bloc.state.toGrade.$1, greaterThan(0));
      bloc.add(const TaskDoneToggled('t_att'));
      await expectLater(bloc.stream, emitsThrough(predicate<TasksState>((s) => s.open.length == 11)));
      expect(db.byId('tk_tasks', 't_att')!['status'], 'done');
      bloc.add(const TaskReviewSaved('t_mid', 42));
      await expectLater(bloc.stream, emitsThrough(predicate<TasksState>((s) => s.tasks.firstWhere((t) => t.id == 't_mid').isDone)));
      await bloc.close();
    });

    test('task form bloc creates and edits', () async {
      final bloc = getIt<TaskFormBloc>()..add(const TaskFormLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<TaskFormState>((s) => s.status == TaskFormStatus.ready)));
      bloc.add(TaskFormSubmitted(TaskItem(id: '', title: 'New one', due: DateTime.now().add(const Duration(days: 1)).toIso8601String())));
      await expectLater(bloc.stream, emitsThrough(predicate<TaskFormState>((s) => s.status == TaskFormStatus.saved)));
      expect(db.list('tk_tasks').where((e) => e['title'] == 'New one').single['status'], 'pending');
      await bloc.close();

      final edit = getIt<TaskFormBloc>()..add(const TaskFormLoadRequested(editId: 't_qe'));
      await expectLater(edit.stream, emitsThrough(predicate<TaskFormState>((s) => s.status == TaskFormStatus.ready && s.task != null)));
      edit.add(TaskFormSubmitted(edit.state.task!.copyWith(title: 'Renamed')));
      await expectLater(edit.stream, emitsThrough(predicate<TaskFormState>((s) => s.status == TaskFormStatus.saved)));
      expect(db.byId('tk_tasks', 't_qe')!['title'], 'Renamed');
      expect(db.byId('tk_tasks', 't_qe')!['homeworkId'], 'hw_set4');
      await edit.close();
    });

    test('duties bloc: swap request, cancel, done toggle', () async {
      final bloc = getIt<DutiesBloc>()..add(const DutiesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<DutiesState>((s) => s.status == DutiesStatus.loaded)));
      expect(bloc.state.duties.length, 6);
      expect(bloc.state.gradingDeadlines.map((h) => h.id), containsAll(['hw_set4', 'hw_review']));
      bloc.add(DutySwapRequested(SwapRequest(dutyId: 'd_exam1', dutyTitle: 'x', swapWith: 'Ms. Anjali Mehta', returnDate: '2030-01-01', returnFrom: '10:00 AM', returnTo: '1:00 PM', reason: 'Academic', note: 'note long enough', createdAt: DateTime.now().toIso8601String())));
      await expectLater(bloc.stream, emitsThrough(predicate<DutiesState>((s) => s.pendingSwap('d_exam1') != null)));
      bloc.add(DutySwapCancelled(bloc.state.pendingSwap('d_exam1')!.id));
      await expectLater(bloc.stream, emitsThrough(predicate<DutiesState>((s) => s.pendingSwap('d_exam1') == null)));
      bloc.add(const DutyDoneToggled('d_gate'));
      await expectLater(bloc.stream, emitsThrough(predicate<DutiesState>((s) => !s.dutyById('d_gate')!.isDone)));
      await bloc.close();
    });

    test('homework bloc grades a submitted paper', () async {
      final bloc = getIt<HomeworkBloc>()..add(const HomeworkLoadRequested('hw_review'));
      await expectLater(bloc.stream, emitsThrough(predicate<HomeworkState>((s) => s.status == HomeworkStatus.loaded)));
      expect(bloc.state.stats.graded, 28);
      final next = bloc.state.stats.next!;
      bloc.add(HomeworkGradeSaved(studentId: next.id, criteria: const [10, 10, 8, 8], feedback: 'Good'));
      await expectLater(bloc.stream, emitsThrough(predicate<HomeworkState>((s) => s.stats.graded == 29)));
      expect(bloc.state.homework!.submissions[next.id]!.marks, 36);
      expect(criteriaOf(bloc.state.homework!.submissions[next.id]!, 50), [10, 10, 8, 8]);
      final missing = bloc.state.stats.rows.firstWhere((r) => r.sub.status.name == 'pending');
      bloc.add(HomeworkSubmissionMarked(missing.id));
      await expectLater(bloc.stream, emitsThrough(predicate<HomeworkState>((s) => s.stats.toGrade == 14)));
      await bloc.close();

      final none = getIt<HomeworkBloc>()..add(const HomeworkLoadRequested('nope'));
      await expectLater(none.stream, emitsThrough(predicate<HomeworkState>((s) => s.status == HomeworkStatus.notFound)));
      await none.close();
    });

    test('syllabus bloc logs a period and submits', () async {
      final bloc = getIt<SyllabusBloc>()..add(const SyllabusLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<SyllabusState>((s) => s.status == SyllabusStatus.loaded)));
      expect(bloc.state.pct, 78);
      bloc.add(const SyllabusPeriodLogged('syl_10a', 3));
      await expectLater(bloc.stream, emitsThrough(predicate<SyllabusState>((s) => s.divisions.first.topics[3].done == 7)));
      bloc.add(const SyllabusSubmissionToggled());
      await expectLater(bloc.stream, emitsThrough(predicate<SyllabusState>((s) => s.meta.submitted)));
      await bloc.close();
    });

    test('rubric caps and level ranges', () {
      expect(criterionCaps(50), [15, 15, 10, 10]);
      expect(levelRanges(15).first, (13, 15));
      expect(bandOf(92), 'Exemplary');
    });
  });

  testWidgets('tasks page: stats, mark done, filter, review, add task', (t) async {
    await pump(t, RoutePaths.tasks);
    expect(find.text('Weekly Workload'), findsOneWidget);
    expect(find.text('Continue Review'), findsOneWidget);
    expect(find.textContaining('All Tasks (12)'), findsOneWidget);
    expect(find.textContaining('38 / 42 Reviewed'), findsOneWidget);

    await tapV(t, find.byTooltip('Mark done'));
    await t.drag(vScroll(), const Offset(0, 3000));
    await t.pumpAndSettle();
    expect(find.textContaining('All Tasks (11)'), findsOneWidget);
    expect(db.list('tk_tasks').where((e) => e['status'] == 'done').length, 24);

    await t.drag(find.textContaining('Due Today ('), const Offset(-200, 0));
    await t.pumpAndSettle();
    await tapV(t, find.textContaining('Grading ('));
    expect(find.text('Academic & Grading'), findsOneWidget);

    await t.tap(find.text('Continue Review'));
    await t.pumpAndSettle();
    await t.tap(find.bySemanticsLabel('Increase reviewed papers'));
    await t.pump();
    await t.tap(find.text('Save Progress'));
    await t.pumpAndSettle();
    expect(db.byId('tk_tasks', 't_mid')!['reviewed'], 39);

    await tapV(t, find.text('Add Task / Reminder'));
    expect(find.text('Create Task'), findsOneWidget);
    await t.tap(find.text('Create Task'));
    await t.pumpAndSettle();
    expect(find.text('Please enter a title'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Prepare unit test');
    await t.tap(find.text('Create Task'));
    await t.pumpAndSettle();
    expect(db.list('tk_tasks').any((e) => e['title'] == 'Prepare unit test'), isTrue);
    expect(find.text('Tasks'), findsWidgets);
  });

  testWidgets('add reminder + edit', (t) async {
    await pump(t, '${RoutePaths.taskAdd}?id=t_att');
    expect(find.text('Edit Task'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Audit renamed');
    await t.tap(find.text('Save Changes'));
    await t.pumpAndSettle();
    expect(db.byId('tk_tasks', 't_att')!['title'], 'Audit renamed');
  });

  testWidgets('new reminder', (t) async {
    await pump(t, RoutePaths.taskAdd);
    await t.tap(find.text('Reminder'));
    await t.pumpAndSettle();
    expect(find.text('Create Reminder'), findsOneWidget);
    expect(find.text('Category'), findsNothing);
    await t.enterText(find.byType(TextFormField).first, 'Call the lab assistant');
    await t.tap(find.text('Create Reminder'));
    await t.pumpAndSettle();
    final r = db.list('tk_tasks').firstWhere((e) => e['title'] == 'Call the lab assistant');
    expect(r['kind'], 'reminder');
    expect(r['category'], 'Reminder');
  });

  testWidgets('duties list, agenda, swap request', (t) async {
    await pump(t, RoutePaths.duties);
    expect(find.text('Duties & Reminders'), findsOneWidget);
    expect(find.text('Curriculum & Half-Yearly Review'), findsOneWidget);
    await tapV(t, find.text('Agenda Details'));
    expect(find.text('Syllabus Completion Audit'), findsOneWidget);
    t.state<NavigatorState>(find.byType(Navigator).first).pop();
    await t.pumpAndSettle();
    await tapV(t, find.text('Request Swap'));
    expect(find.text('Request Duty Swap'), findsOneWidget);
    await tapV(t, find.text('Send Swap Request'));
    expect(db.list('tk_swaps'), isEmpty); // note required
    await t.enterText(find.byType(TextField).last, 'Remedial session scheduled for Grade 12');
    await tapV(t, find.text('Send Swap Request'));
    expect(db.list('tk_swaps').single['status'], 'pending');
    expect(find.text('Swap request pending'), findsWidgets);
  });

  testWidgets('duty detail', (t) async {
    await pump(t, RoutePaths.duty('d_exam1'));
    expect(find.text('Half-Yearly Examination (Physics & Math)'), findsOneWidget);
    expect(find.text('Assigned Staff'), findsOneWidget);
    await t.tap(find.text('Mark Completed'));
    await t.pumpAndSettle();
    expect(db.byId('tk_duties', 'd_exam1')!['status'], 'done');
    expect(find.text('Reopen Duty'), findsOneWidget);
  });

  testWidgets('homework detail, graded list, edit grades', (t) async {
    await pump(t, RoutePaths.homework('hw_review'));
    expect(find.text('Quadratic Equations Review'), findsOneWidget);
    expect(find.textContaining('28/42 Evaluated'), findsOneWidget);
    expect(find.text('Conceptual Understanding'), findsOneWidget);
    await tapV(t, find.textContaining('Graded List'));
    expect(find.textContaining('SHOWING'), findsOneWidget);
    await tapV(t, find.textContaining('To Grade ('));
    await tapV(t, find.text('Grade Now'));
    expect(find.text('Grade Student'), findsOneWidget);
    for (var i = 0; i < 4; i++) {
      await t.tap(find.bySemanticsLabel('Increase Conceptual Understanding'));
      await t.pump();
    }
    await t.tap(find.text('Save Grades'));
    await t.pumpAndSettle();
    await t.drag(vScroll(), const Offset(0, 3000));
    await t.pumpAndSettle();
    expect(find.textContaining('29/42 Evaluated'), findsOneWidget);
    final subs = (db.byId('tk_homework', 'hw_review')!['submissions'] as Map).values.where((e) => e['status'] == 'graded');
    expect(subs.length, 29);
  });

  testWidgets('re-grading requires a rationale', (t) async {
    await pump(t, RoutePaths.homeworkGraded('hw_review'));
    await tapV(t, find.byIcon(Icons.edit_note_rounded));
    expect(find.text('Edit Grades'), findsOneWidget);
    await tapV(t, find.text('Save & Update'));
    await t.scrollUntilVisible(find.text('Select a reason for the score adjustment'), 300, scrollable: vScroll());
    expect(find.text('Select a reason for the score adjustment'), findsOneWidget);
    await tapV(t, find.text('Clerical Correction'));
    await tapV(t, find.text('Save & Update'));
    final graded = (db.byId('tk_homework', 'hw_review')!['submissions'] as Map).values.where((e) => e['rationale'] == 'Clerical Correction');
    expect(graded.length, 1);
  });

  testWidgets('graded route', (t) async {
    await pump(t, RoutePaths.homeworkGraded('hw_set4'));
    expect(find.text('Homework Grading'), findsOneWidget);
    expect(find.text('Quadratic Equations - Set 4'), findsOneWidget);
    expect(find.textContaining('30/34 Evaluated'), findsOneWidget);
  });

  testWidgets('progress log submit + log period', (t) async {
    await pump(t, RoutePaths.homeworkProgress('hw_set4'));
    expect(find.text('Syllabus Progress Log'), findsOneWidget);
    expect(find.text('78%'), findsOneWidget);
    await tapV(t, find.textContaining('tap to log 1'));
    expect(db.byId('tk_syllabus', 'syl_10a')!['hours'], 43);
    await t.tap(find.text('Submit to VP for Approval'));
    await t.pumpAndSettle();
    expect(db.doc('tk_syllabus_meta')['status'], 'submitted');
    expect(find.text('Withdraw Submission'), findsOneWidget);
  });
}
