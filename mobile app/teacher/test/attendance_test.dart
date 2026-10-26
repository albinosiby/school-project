import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:teacher_app/config/routes/modules/attendance_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/attendance/bloc/circulars_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/circulars_events.dart';
import 'package:teacher_app/modules/attendance/bloc/circulars_states.dart';
import 'package:teacher_app/modules/attendance/bloc/leave_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/leave_events.dart';
import 'package:teacher_app/modules/attendance/bloc/leave_states.dart';
import 'package:teacher_app/modules/attendance/bloc/load_status.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_events.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_states.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_events.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_states.dart';
import 'package:teacher_app/modules/attendance/bloc/overview_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/overview_events.dart';
import 'package:teacher_app/modules/attendance/bloc/overview_states.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_events.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_states.dart';
import 'package:teacher_app/modules/attendance/bloc/slips_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/slips_events.dart';
import 'package:teacher_app/modules/attendance/bloc/slips_states.dart';
import 'package:teacher_app/modules/attendance/bloc/trends_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/trends_events.dart';
import 'package:teacher_app/modules/attendance/bloc/trends_states.dart';
import 'package:teacher_app/modules/attendance/models/attendance_models.dart';
import 'package:teacher_app/modules/attendance/models/leave_models.dart';
import 'package:teacher_app/modules/attendance/models/marks_models.dart';
import 'package:teacher_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:teacher_app/utils/services/local_database_service.dart';
import 'helpers/pump_app.dart';

late LocalDatabaseService db;

Future<void> open(WidgetTester t, String location) => pumpScreen(t, location: location, routes: attendanceRoutes);

/// Runs [body] with RenderFlex overflow reports (test font is wider than Inter) filtered out.
Future<void> quiet(Future<void> Function() body) async {
  final orig = FlutterError.onError;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return;
    orig?.call(d);
  };
  try {
    await body();
  } finally {
    FlutterError.onError = orig;
  }
}

Finder get scroll => find.byType(Scrollable).first;

Future<void> tapText(WidgetTester t, String text) async {
  await t.ensureVisible(find.text(text).last);
  await t.pumpAndSettle();
  await t.tap(find.text(text).last);
  await t.pumpAndSettle();
}

void main() {
  setUp(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    db = await setUpTestApp();
  });

  group('blocs', () {
    test('mark attendance bloc loads homeroom roster and saves a record', () async {
      final bloc = getIt<MarkAttendanceBloc>()..add(const MarkAttendanceLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<MarkAttendanceState>((s) => s.status == LoadStatus.loaded && s.marks.length == 42)));
      expect(bloc.state.classId, 'cls_10B');
      bloc.add(const MarkAttendanceAllSet(AttCode.absent));
      bloc.add(const MarkAttendanceSaved(submit: true));
      await expectLater(bloc.stream, emitsThrough(predicate<MarkAttendanceState>((s) => s.submitted)));
      final rec = await getIt<IAttendanceRepository>().findRecord('cls_10B', dkey(todayDate()), 3);
      expect(rec!.counts.absent, 42);
      await bloc.close();
    });

    test('trends bloc computes an average around 90% and at-risk students', () async {
      final bloc = getIt<TrendsBloc>()..add(const TrendsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<TrendsState>((s) => s.status == LoadStatus.loaded && s.history.isNotEmpty)));
      expect(averageRate(bloc.state.history), inInclusiveRange(85, 96));
      expect(bloc.state.atRisk.map((s) => s.id), contains('stu_103'));
      bloc.add(const TrendsRangeChanged('Term 2'));
      await expectLater(bloc.stream, emitsThrough(predicate<TrendsState>((s) => s.range == 'Term 2')));
      await bloc.close();
    });

    test('self log bloc stores a regularization request', () async {
      final bloc = getIt<SelfLogBloc>()..add(const SelfLogLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<SelfLogState>((s) => s.status == LoadStatus.loaded)));
      bloc.add(const SelfLogRegularizationSubmitted(Regularization(date: '2026-10-20', type: 'Check-in', time: '08:15', reason: 'Other', note: 'Gate duty')));
      await expectLater(bloc.stream, emitsThrough(predicate<SelfLogState>((s) => s.regs.length == 1)));
      await bloc.close();
    });

    test('overview bloc approves a pending slip', () async {
      final bloc = getIt<OverviewBloc>()..add(const OverviewLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<OverviewState>((s) => s.status == LoadStatus.loaded && s.pendingSlips.length == 2)));
      expect(bloc.state.schedule.length, 3);
      bloc.add(const OverviewLeaveSlipApproved('ls_2'));
      await expectLater(bloc.stream, emitsThrough(predicate<OverviewState>((s) => s.pendingSlips.length == 1)));
      await bloc.close();
    });

    test('slips bloc rejects a medical slip with a reason', () async {
      final bloc = getIt<SlipsBloc>()..add(const SlipsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<SlipsState>((s) => s.status == LoadStatus.loaded)));
      bloc.add(const MedicalSlipDecided('md_1', approved: false, reason: 'Unclear'));
      await expectLater(bloc.stream, emitsThrough(predicate<SlipsState>((s) => s.medical.any((m) => m.id == 'md_1' && m.status == 'Rejected'))));
      expect(db.byId('att_medical', 'md_1')!['reason'], 'Unclear');
      await bloc.close();
    });

    test('marks bloc filters and saves marks', () async {
      final bloc = getIt<MarksBloc>()..add(const MarksLoadRequested(examId: 'ex_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<MarksState>((s) => s.status == LoadStatus.loaded)));
      expect(bloc.state.statsOf(bloc.state.exam!).pending, 6);
      bloc.add(const MarksFilterChanged('Pending'));
      await expectLater(bloc.stream, emitsThrough(predicate<MarksState>((s) => s.shown.length == 6)));
      bloc.add(const MarkSaved(StudentMark(examId: 'ex_1', studentId: 'stu_268', marks: 40)));
      await expectLater(bloc.stream, emitsThrough(predicate<MarksState>((s) => s.shown.length == 5)));
      expect(db.byId('att_marks', 'ex_1_stu_268')!['marks'], 40);
      await bloc.close();
    });

    test('leave bloc loads quota and applies', () async {
      final bloc = getIt<LeaveBloc>()..add(const LeaveLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<LeaveState>((s) => s.status == LoadStatus.loaded)));
      expect(bloc.state.quotaFor('CL')!.available, 6);
      bloc.add(LeaveApplied(LeaveApplication(type: 'Casual Leave', start: plusDays(3), end: plusDays(3), days: 1, reason: 'Workshop attendance')));
      await expectLater(bloc.stream, emitsThrough(predicate<LeaveState>((s) => s.applications.length == 2)));
      await bloc.close();
    });

    test('circulars bloc filters, pins and acknowledges', () async {
      final bloc = getIt<CircularsBloc>()..add(const CircularsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<CircularsState>((s) => s.status == LoadStatus.loaded && s.items.length == 14)));
      bloc.add(const CircularsCategoryChanged('Events'));
      await expectLater(bloc.stream, emitsThrough(predicate<CircularsState>((s) => s.shown.length == 2)));
      bloc.add(const CircularPinToggled('cir_3'));
      await expectLater(bloc.stream, emitsThrough(predicate<CircularsState>((s) => s.shown.first.id == 'cir_3')));
      bloc.add(const CircularAcknowledged('cir_3'));
      await expectLater(bloc.stream, emitsThrough(predicate<CircularsState>((s) => s.byId('cir_3')!.ack)));
      await bloc.close();
    });
  });

  testWidgets('mark attendance: bulk absent, submit saves record', (t) => quiet(() async {
        await open(t, RoutePaths.attendanceMark);
        expect(find.text('Mark All Absent'), findsOneWidget);
        await tapText(t, 'Mark All Absent');
        expect(find.textContaining('0/42 Present'), findsOneWidget);
        await t.tap(find.text('Submit Attendance'));
        await t.pumpAndSettle();
        final rec = db.list('att_records').where((r) => r['date'] == dkey(todayDate()) && r['classId'] == 'cls_10B').toList();
        expect(rec.length, 1);
        expect(rec.first['submitted'], true);
        expect(AttendanceRecord.fromJson(rec.first).counts.absent, 42);
        expect(find.text('Update'), findsOneWidget);
      }));

  testWidgets('trends shows chart and sends a parent notification', (t) => quiet(() async {
        await open(t, RoutePaths.attendanceTrends);
        expect(find.text('Daily Attendance Trend'), findsOneWidget);
        await t.scrollUntilVisible(find.text('Notify Parent'), 300, scrollable: scroll);
        await t.pumpAndSettle();
        await t.tap(find.text('Notify Parent').first);
        await t.pumpAndSettle();
        expect(find.text('Send Notification Now'), findsOneWidget);
        await tapText(t, 'Send Notification Now');
        expect(db.list('att_notices'), isNotEmpty);
      }));

  testWidgets('trends view log sheet filters absences', (t) => quiet(() async {
        await open(t, RoutePaths.attendanceTrends);
        await t.scrollUntilVisible(find.text('View Log'), 300, scrollable: scroll);
        await t.pumpAndSettle();
        await t.tap(find.text('View Log').first);
        await t.pumpAndSettle();
        expect(find.text('Student Attendance Log'), findsOneWidget);
        await t.tap(find.textContaining('Absences Only'));
        await t.pumpAndSettle();
        expect(find.text('Absent • Unexcused'), findsWidgets);
      }));

  testWidgets('self log regularization validates and saves', (t) => quiet(() async {
        await open(t, RoutePaths.attendanceSelfLog);
        expect(find.text('Staff Self-Log'), findsWidgets);
        await t.scrollUntilVisible(find.text('Request Attendance Regularization'), 400, scrollable: scroll);
        await tapText(t, 'Request Attendance Regularization');
        await tapText(t, 'Submit Regularization Request');
        expect(find.textContaining('justification'), findsOneWidget);
        await t.enterText(find.byType(TextField).last, 'Conducted gate assembly duty');
        await tapText(t, 'Submit Regularization Request');
        expect(db.list('att_regs').length, 1);
      }));

  testWidgets('medical slips approve', (t) => quiet(() async {
        await open(t, RoutePaths.medicalSlips);
        expect(find.text('Approve Leave'), findsOneWidget);
        await tapText(t, 'Approve Leave');
        expect(db.byId('att_medical', 'md_1')!['status'], 'Approved');
      }));

  testWidgets('overview lists periods and pending slips', (t) => quiet(() async {
        await open(t, RoutePaths.attendanceHistory);
        expect(find.text('Assigned Periods Today'), findsOneWidget);
        await t.scrollUntilVisible(find.text('Pending Leave Slips'), 300, scrollable: scroll);
        await t.drag(scroll, const Offset(0, -300));
        await t.pumpAndSettle();
        await t.tap(find.text('Approve').first);
        await t.pumpAndSettle();
        expect(db.list('att_slips').where((s) => s['status'] == 'Approved').length, 1);
      }));

  testWidgets('leave slip approve', (t) => quiet(() async {
        await open(t, RoutePaths.leaveSlip('ls_1'));
        expect(find.text('Approve Leave Slip'), findsOneWidget);
        await t.tap(find.text('Approve Leave Slip'));
        await t.pumpAndSettle();
        expect(db.byId('att_slips', 'ls_1')!['status'], 'Approved');
      }));

  testWidgets('marks list: submit blocked, pending filter, validation', (t) => quiet(() async {
        await open(t, RoutePaths.marks);
        expect(find.text('Submit Marks'), findsOneWidget);
        await t.tap(find.text('Submit Marks'));
        await t.pumpAndSettle();
        expect(db.byId('att_exams', 'ex_1')!['status'], 'Draft');
        expect(find.text('Quick Assign:'), findsWidgets);
        await t.enterText(find.byType(TextField).at(1), '99');
        await t.pumpAndSettle();
        expect(find.text('Max is 50'), findsOneWidget);
      }));

  testWidgets('marks enter per student validates and saves', (t) => quiet(() async {
        await open(t, Uri(path: RoutePaths.marksEnter, queryParameters: {'exam': 'ex_1', 'student': 'stu_268'}).toString());
        expect(find.text('Save & Next'), findsOneWidget);
        await t.tap(find.text('Save Draft'));
        await t.pumpAndSettle();
        expect(find.text('Enter the total marks'), findsOneWidget);
        await tapText(t, 'Full (50)');
        await t.tap(find.text('Save Draft'));
        await t.pumpAndSettle();
        expect(db.byId('att_marks', 'ex_1_stu_268')!['marks'], 50);
      }));

  testWidgets('marks edit requires a reason', (t) => quiet(() async {
        await open(t, Uri(path: RoutePaths.marksEdit, queryParameters: {'exam': 'ex_3', 'student': 'stu_143'}).toString());
        expect(find.text('Update Student Marks'), findsOneWidget);
        await t.tap(find.text('Update Student Marks'));
        await t.pumpAndSettle();
        expect(db.byId('att_marks', 'ex_3_stu_143')!['history'], isNull);
        final reason = find.widgetWithText(TextField, 'e.g. Re-evaluation of Q12 approved by HOD');
        await t.scrollUntilVisible(reason, 300, scrollable: scroll);
        await t.enterText(reason, 'Re-evaluation approved');
        await t.tap(find.text('Update Student Marks'));
        await t.pumpAndSettle();
        expect((db.byId('att_marks', 'ex_3_stu_143')!['history'] as List).length, 1);
      }));

  testWidgets('apply leave validates, adds handover, submits', (t) => quiet(() async {
        await open(t, RoutePaths.leaveApply);
        await t.tap(find.text('Submit Leave Application'));
        await t.pumpAndSettle();
        expect(find.textContaining('at least 10'), findsWidgets);
        await t.enterText(find.byType(TextField).first, 'Attending a curriculum workshop');
        await t.scrollUntilVisible(find.text('Add Handover'), 300, scrollable: scroll);
        await tapText(t, 'Add Handover');
        await t.tap(find.textContaining('Period 3').first);
        await t.pumpAndSettle();
        await tapText(t, 'Mrs. Sunita Kapoor');
        final topic = find.widgetWithText(TextFormField, 'Chapter 4: Quadratic Equations — Exercise 4.3 Practice').first;
        await t.ensureVisible(topic);
        await t.enterText(topic, 'Chapter 4');
        await tapText(t, 'Confirm & Assign Handover');
        expect(find.text('Confirmed'), findsOneWidget);
        await t.tap(find.text('Submit Leave Application'));
        await t.pumpAndSettle();
        expect(db.list('att_leaves').length, 2);
        expect((db.list('att_leaves').first['handovers'] as List).length, 1);
      }));

  testWidgets('circulars list, open marks read, acknowledge', (t) => quiet(() async {
        await open(t, RoutePaths.circulars);
        expect(find.text('General Circulars'), findsOneWidget);
        await t.tap(find.textContaining('Parent-Teacher Meeting'));
        await t.pumpAndSettle();
        expect(find.text('Acknowledge Circular'), findsOneWidget);
        expect(db.byId('att_circulars', 'cir_1')!['read'], true);
        await t.tap(find.text('Acknowledge Circular'));
        await t.pumpAndSettle();
        expect(db.byId('att_circulars', 'cir_1')!['ack'], true);
      }));
}

String plusDays(int n) => dkey(todayDate().add(Duration(days: n)));
