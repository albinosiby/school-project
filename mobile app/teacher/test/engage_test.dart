import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:teacher_app/config/routes/modules/engage_routes.dart';
import 'package:teacher_app/config/routes/routes.dart';
import 'package:teacher_app/design_system/design_system.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/engage/bloc/engage_notice.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_events.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_states.dart';
import 'package:teacher_app/modules/engage/bloc/hall_seating_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/hall_seating_events.dart';
import 'package:teacher_app/modules/engage/bloc/hall_seating_states.dart';
import 'package:teacher_app/modules/engage/bloc/leave_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/leave_events.dart';
import 'package:teacher_app/modules/engage/bloc/leave_states.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_events.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_states.dart';
import 'package:teacher_app/modules/engage/bloc/meeting_room_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/meeting_room_events.dart';
import 'package:teacher_app/modules/engage/bloc/meeting_room_states.dart';
import 'package:teacher_app/modules/engage/bloc/meetings_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/meetings_events.dart';
import 'package:teacher_app/modules/engage/bloc/meetings_states.dart';
import 'package:teacher_app/modules/engage/bloc/messages_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/messages_events.dart';
import 'package:teacher_app/modules/engage/bloc/messages_states.dart';
import 'package:teacher_app/modules/engage/models/live_class_models.dart';
import 'package:teacher_app/modules/engage/models/meeting_models.dart';
import 'package:teacher_app/modules/engage/screens/exam_hall_screen.dart';
import 'package:teacher_app/utils/helpers/date_helper.dart';
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

LocalDatabaseService get db => getIt<LocalDatabaseService>();

Future<void> pump(WidgetTester t, String location) async {
  ignoreOverflow();
  await pumpScreen(t, location: location, routes: [
    GoRoute(path: RoutePaths.leaveApply, builder: (_, _) => const Scaffold(body: Text('Apply stub'))),
    GoRoute(path: RoutePaths.home, builder: (_, _) => const Scaffold(body: Text('Home stub'))),
    ...engageRoutes,
  ]);
}

Future<void> tapV(WidgetTester t, Finder f, {int which = 0, bool settle = true}) async {
  if (find.byType(Scaffold).evaluate().isNotEmpty) {
    ScaffoldMessenger.of(t.element(find.byType(Scaffold).first)).removeCurrentSnackBar();
    await t.pump();
  }
  final sc = find.byType(Scrollable);
  if (f.evaluate().isEmpty && sc.evaluate().isNotEmpty) {
    await t.fling(sc.first, const Offset(0, 3000), 5000);
    await t.pump(const Duration(seconds: 1));
  }
  if (f.evaluate().isEmpty && sc.evaluate().isNotEmpty) {
    await t.scrollUntilVisible(f, 250, scrollable: sc.first);
  }
  final target = f.at(which);
  await t.ensureVisible(target);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(target);
  settle ? await t.pumpAndSettle() : await t.pump(const Duration(seconds: 1));
}

Future<void> unmount(WidgetTester t) async {
  await t.pumpWidget(const SizedBox());
  await t.pump();
}

Future<void> tapChip(WidgetTester t, String label) async {
  await t.fling(find.byType(Scrollable).first, const Offset(0, 3000), 5000);
  await t.pumpAndSettle();
  final chips = find.descendant(of: find.byType(FilterChips), matching: find.byType(Scrollable));
  await t.dragUntilVisible(find.text(label), chips.first, const Offset(-100, 0));
  await t.ensureVisible(find.text(label));
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(find.text(label));
  await t.pumpAndSettle();
}

Future<void> enterBody(WidgetTester t, String text) async {
  final f = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Write your message...');
  if (f.evaluate().isEmpty) await t.scrollUntilVisible(f, 300, scrollable: find.byType(Scrollable).first);
  await t.enterText(f, text);
  await t.pump();
}

Finder sem(String l) => find.byWidgetPredicate((w) => w is Semantics && w.properties.label == l);

Rec row(String c, String id) => db.byId(c, id)!;

void main() {
  setUp(setUpTestApp);

  group('blocs', () {
    test('LiveClassesBloc loads, saves a draft and ends a class', () async {
      final bloc = getIt<LiveClassesBloc>()..add(const LiveClassesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<LiveClassesState>((s) => s.status == EngageStatus.loaded && s.upcoming.length == 3 && s.past.length == 12)));
      bloc.add(LiveSessionSaved(LiveSession(title: 'Draft session', classId: 'cls_10B', date: plusDays(2), time: '10:00', total: 42), draft: true));
      await expectLater(bloc.stream, emitsThrough(predicate<LiveClassesState>((s) => s.notice?.message == 'Draft saved' && s.notice!.pop)));
      expect(db.list('lv_sessions').where((e) => e['title'] == 'Draft session' && e['status'] == 'draft'), hasLength(1));
      bloc.add(const LiveSessionEnded('lv_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<LiveClassesState>((s) => s.byId('lv_1')?.isPast == true)));
      await bloc.close();
    });

    test('LeaveBloc cancels my leave and decides a student leave', () async {
      final bloc = getIt<LeaveBloc>()..add(const LeaveLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<LeaveState>((s) => s.status == EngageStatus.loaded && s.upcoming.length == 1)));
      expect(bloc.state.used('Casual Leave'), 1.5);
      bloc.add(const MyLeaveCancelled('lm_m1'));
      await expectLater(bloc.stream, emitsThrough(predicate<LeaveState>((s) => s.upcoming.isEmpty)));
      bloc.add(const StudentLeaveDecided('ls_1', approve: false, note: 'No slip'));
      await expectLater(bloc.stream, emitsThrough(predicate<LeaveState>((s) => s.notice?.message == 'Leave denied for Dev Malhotra')));
      expect(row('lm_student', 'ls_1')['status'], 'rejected');
      expect(row('lm_student', 'ls_1')['processedBy'], 'by Mrs. Anita Sharma');
      await bloc.close();
    });

    test('MeetingsBloc saves and deletes', () async {
      final bloc = getIt<MeetingsBloc>()..add(const MeetingsLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingsState>((s) => s.status == EngageStatus.loaded && s.all.length == 3 && s.completed.length == 1)));
      bloc.add(MeetingSaved(Meeting(title: 'New PTM', classId: 'cls_9A', date: plusDays(3), time: '09:00', total: 38, agenda: const [AgendaTopic(title: 'Intro', mins: 10)])));
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingsState>((s) => s.meetings.length == 4 && s.notice?.message == 'Invites sent to 38 parents')));
      bloc.add(const MeetingDeleted('pm_2'));
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingsState>((s) => s.meetings.length == 3)));
      await bloc.close();
    });

    test('MeetingRoomBloc creates the room, admits, chats and ends', () async {
      final bloc = getIt<MeetingRoomBloc>()..add(const MeetingRoomLoadRequested('pm_2'));
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingRoomState>((s) => s.status == EngageStatus.loaded && s.participants.length == 8 && s.waiting.length == 2)));
      bloc.add(const AllGuestsAdmitted());
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingRoomState>((s) => s.waiting.isEmpty && s.headcount == 11)));
      bloc.add(const ChatMessageSent('Hello parents'));
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingRoomState>((s) => s.chat.any((c) => c.text == 'Hello parents' && c.mine))));
      bloc.add(const MeetingLeft(endForAll: true, seconds: 90));
      await expectLater(bloc.stream, emitsThrough(predicate<MeetingRoomState>((s) => s.meeting?.completed == true)));
      expect(row('pm_meetings', 'pm_2')['summary'], 'Held online for 2 min. 11 participants joined.');
      await bloc.close();
    });

    test('ExamDutiesBloc toggles checklist and swaps', () async {
      final bloc = getIt<ExamDutiesBloc>()..add(const ExamDutiesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<ExamDutiesState>((s) => s.status == EngageStatus.loaded && s.next?.id == 'ed_1' && s.swaps.length == 1)));
      bloc.add(const ChecklistItemToggled('ed_1', 2, checked: true));
      await expectLater(bloc.stream, emitsThrough(predicate<ExamDutiesState>((s) => s.byId('ed_1')!.checked.contains(2))));
      bloc.add(const SwapRequested('ed_1', withWhom: 'Mr. Ramesh Gupta', reason: 'Travel'));
      await expectLater(bloc.stream, emitsThrough(predicate<ExamDutiesState>((s) => s.swaps.length == 2)));
      bloc.add(const SwapCancelled('ed_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<ExamDutiesState>((s) => s.swaps.length == 1)));
      await bloc.close();
    });

    test('HallSeatingBloc marks candidates and issues sheets', () async {
      final bloc = getIt<HallSeatingBloc>()..add(const HallSeatingLoadRequested('ed_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<HallSeatingState>((s) => s.status == EngageStatus.loaded && s.candidates.length == 42 && s.absent == 2)));
      bloc.add(const CandidateMarked('edc_ed_1_1', present: false));
      await expectLater(bloc.stream, emitsThrough(predicate<HallSeatingState>((s) => s.absent == 3)));
      bloc.add(const SupplementaryChanged('edc_ed_1_1', 1));
      await expectLater(bloc.stream, emitsThrough(predicate<HallSeatingState>((s) => s.byId('edc_ed_1_1')!.suppCode == 'SUP-4491')));
      bloc.add(const FinalListSubmitted());
      await expectLater(bloc.stream, emitsThrough(predicate<HallSeatingState>((s) => s.duty!.submitted)));
      await bloc.close();
    });

    test('MessagesBloc sends, replies and keeps integer unread', () async {
      final bloc = getIt<MessagesBloc>()..add(const MessagesLoadRequested());
      await expectLater(bloc.stream, emitsThrough(predicate<MessagesState>((s) => s.status == EngageStatus.loaded && s.unreadThreads == 2 && s.drafts.length == 4)));
      bloc.add(const ThreadOpened('ms_3'));
      await expectLater(bloc.stream, emitsThrough(predicate<MessagesState>((s) => s.unreadThreads == 1)));
      expect(row('ms_messages', 'ms_3')['unread'], isA<int>());
      bloc.add(const MessageSent(to: ['g_stu_101'], text: 'Hello guardian', draftId: 'md_1'));
      await expectLater(bloc.stream, emitsThrough(predicate<MessagesState>((s) => s.threads.any((t) => t.key == 'g_stu_101') && s.drafts.length == 3)));
      bloc.add(const ReplySent('ms_2', 'On it'));
      await expectLater(bloc.stream, emitsThrough(predicate<MessagesState>((s) => s.thread('ms_2')!.last!.text == 'On it')));
      await bloc.close();
    });
  });

  testWidgets('live classes: list, tabs, schedule validation + create', (t) async {
    await pump(t, RoutePaths.liveClasses);
    expect(find.text('Digital Sessions Manager'), findsOneWidget);
    expect(find.text('Start Class Now'), findsOneWidget);
    expect(find.text('Scheduled Pipeline'), findsOneWidget);
    expect(find.text('Live & Upcoming (3)'), findsOneWidget);
    await tapV(t, find.text('Past Recordings (12)'));
    expect(find.text('Play Recording'), findsWidgets);
    await tapChip(t, 'Class Schedules');
    expect(find.textContaining('Olympiad'), findsWidgets);
    await tapV(t, find.text('Schedule Live Class'));
    expect(find.text('Target Class & Section'), findsOneWidget);
    await tapV(t, find.text('Schedule & Send'));
    expect(find.textContaining('Enter a session title'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Algebra revision clinic');
    await t.pump();
    await tapV(t, find.text('Schedule & Send'));
    expect(db.list('lv_sessions').where((e) => e['title'] == 'Algebra revision clinic'), hasLength(1));
    expect(find.text('Digital Sessions Manager'), findsOneWidget);
  });

  testWidgets('live class lobby -> in-class -> end', (t) async {
    await pump(t, RoutePaths.liveClassJoin('lv_1'));
    expect(find.text('Join Now'), findsOneWidget);
    expect(find.text('HD Camera Active'), findsOneWidget);
    await tapV(t, sem('Turn camera off'));
    expect(find.text('Camera Off'), findsOneWidget);
    await tapV(t, find.text('Join Now'), settle: false);
    expect(row('lv_sessions', 'lv_1')['status'], 'live');
    await tapV(t, sem('End class'), settle: false);
    await tapV(t, find.text('End class'), settle: false);
    await t.pump(const Duration(seconds: 1));
    expect(row('lv_sessions', 'lv_1')['status'], 'past');
    expect(find.text('Home stub'), findsOneWidget);
    await unmount(t);
  });

  testWidgets('leave management: my leaves + approve/deny student leave', (t) async {
    await pump(t, RoutePaths.leaveManagement);
    expect(find.text('Upcoming Scheduled Leave'), findsOneWidget);
    expect(find.textContaining('Duty Handover'), findsOneWidget);
    await tapV(t, find.text('Cancel Leave'));
    await tapV(t, find.text('Cancel leave'));
    expect(row('lm_my', 'lm_m1')['status'], 'Cancelled');
    await tapV(t, find.text('Apply Leave'));
    expect(find.text('Apply stub'), findsOneWidget);

    await pump(t, RoutePaths.studentLeaves);
    expect(find.text('Pending Review (3)'), findsOneWidget);
    expect(find.textContaining('Dev Malhotra', findRichText: true, skipOffstage: false), findsOneWidget);
    await tapV(t, find.text('Approve'), which: 0);
    await tapV(t, find.text('Approve').last);
    expect(row('lm_student', 'ls_1')['status'], 'approved');
    await t.fling(find.byType(Scrollable).first, const Offset(0, 3000), 5000);
    await t.pumpAndSettle();
    expect(find.text('Pending Review (2)'), findsOneWidget);
    await tapV(t, find.text('Deny'), which: 0);
    await tapV(t, find.text('Deny').last);
    expect(db.list('lm_student').where((e) => e['status'] == 'rejected'), hasLength(2));
    await tapChip(t, 'Rejected (2)');
    expect(find.textContaining('Simran Kaur', findRichText: true, skipOffstage: false), findsWidgets);
  });

  testWidgets('meetings: list, schedule validation, add topic, create', (t) async {
    await pump(t, RoutePaths.meetings);
    expect(find.text('All Meetings (3)'), findsOneWidget);
    expect(find.text('Start / Join Meet', skipOffstage: false), findsWidgets);
    expect(find.text('3 Key Topics', skipOffstage: false), findsWidgets);
    await tapChip(t, 'Completed (1)');
    expect(find.text('Term 1 Result Discussion'), findsOneWidget);
    await tapV(t, find.text('Schedule Meeting'));
    await tapV(t, find.text('Send Invites & Schedule'));
    expect(find.textContaining('Enter a meeting title'), findsOneWidget);
    await t.scrollUntilVisible(find.text('Add at least one agenda topic'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Add at least one agenda topic'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).first, 'Pre-board parent briefing');
    await t.fling(find.byType(Scrollable).first, const Offset(0, 3000), 5000);
    await t.pumpAndSettle();
    await tapV(t, find.text('Add Topic'));
    await tapV(t, find.text('Add Topic').last);
    expect(find.text('Topic name is required'), findsOneWidget);
    await t.enterText(find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextFormField)).first, 'Board exam tips');
    await tapV(t, find.text('Add Topic').last);
    expect(find.textContaining('Board exam tips', skipOffstage: false), findsOneWidget);
    await tapV(t, find.text('Send Invites & Schedule'));
    expect(db.list('pm_meetings').where((e) => e['title'] == 'Pre-board parent briefing'), hasLength(1));
  });

  testWidgets('meeting lobby and room: admit, chat, mute all, end meeting', (t) async {
    await pump(t, RoutePaths.meetingJoin('pm_1'));
    expect(find.text('Join Now as Host'), findsOneWidget);
    expect(find.text('2 Parents in Lobby'), findsOneWidget);
    await tapV(t, find.text('Join Now as Host'), settle: false);
    await t.pump(const Duration(seconds: 1));
    expect(find.text('Parent Townhall'), findsOneWidget);
    expect(find.text('2 parents in waiting room'), findsOneWidget);
    await tapV(t, find.text('Admit'), settle: false);
    expect(db.list('pm_waiting'), isEmpty);
    expect(db.list('pm_participants').length, 10);
    await tapV(t, sem('Live chat'), settle: false);
    expect(find.textContaining('Welcome parents'), findsWidgets);
    await t.pump(const Duration(seconds: 1));
    await t.enterText(find.byType(TextField).last, 'Thanks everyone');
    await tapV(t, find.byTooltip('Send'), settle: false);
    expect(db.list('pm_chat').where((c) => c['text'] == 'Thanks everyone'), hasLength(1));
    Navigator.of(t.element(find.byType(BottomSheet))).pop();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.byType(BottomSheet), findsNothing);
    await tapV(t, sem('Participants'), settle: false);
    expect(find.text('In Meeting (11)'), findsOneWidget);
    await t.pump(const Duration(seconds: 1));
    await tapV(t, find.text('Mute All'), settle: false);
    expect(db.list('pm_participants').every((p) => p['muted'] == true), isTrue);
    Navigator.of(t.element(find.byType(BottomSheet))).pop();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.byType(BottomSheet), findsNothing);
    await tapV(t, sem('Leave').last, settle: false);
    await tapV(t, find.text('End meeting for all'), settle: false);
    await t.pump(const Duration(seconds: 1));
    expect(row('pm_meetings', 'pm_1')['status'], 'completed');
    expect(find.text('Home stub'), findsOneWidget);
    await unmount(t);
  });

  testWidgets('exam duties: list, swap request, details, hall, candidate', (t) async {
    await pump(t, RoutePaths.examDuties);
    expect(find.text('Invigilator Protocol Checklist'), findsOneWidget);
    expect(find.text('All Duties (6)'), findsOneWidget);
    await tapV(t, find.text('Request Swap'));
    await tapV(t, find.text('Send Request'));
    expect(find.text('Please give a reason'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).last, 'Medical appointment');
    await tapV(t, find.text('Send Request'));
    expect(row('ed_duties', 'ed_1')['swap'], 'requested');
    await tapV(t, find.byType(CheckboxListTile), which: 0);
    expect(row('ed_duties', 'ed_1')['checked'] as List, [0]);

    await pump(t, RoutePaths.examDuty('ed_1'));
    expect(find.text('Invigilation Team'), findsOneWidget);
    expect(find.text('Shift Timeline'), findsOneWidget);
    await tapV(t, find.text('Cancel Swap'));
    expect(row('ed_duties', 'ed_1')['swap'], '');

    await pump(t, RoutePaths.examHall('ed_1'));
    expect(find.text('Blackboard & Podium Front'), findsOneWidget);
    expect(find.text('Total Desks'), findsOneWidget);
    expect(find.text('02'), findsOneWidget);
    await tapV(t, find.text('Candidate Details'));
    await tapV(t, find.descendant(of: find.byType(CandidateCard).first, matching: find.text('Absent')));
    expect(row('ed_candidates', 'edc_ed_1_1')['status'], 'absent');
    await tapV(t, find.text('Submit Final List'));
    await tapV(t, find.text('Submit').last);
    expect(row('ed_duties', 'ed_1')['submitted'], true);

    await pump(t, RoutePaths.examCandidate('ed_1', 'edc_ed_1_2'));
    expect(find.text('Candidate Details'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).last, 'Passed a note');
    await tapV(t, find.text('Save Note'));
    expect(row('ed_candidates', 'edc_ed_1_2')['malpractice'], 'Passed a note');
    await tapV(t, find.byTooltip('Issue supplementary sheet'));
    expect(row('ed_candidates', 'edc_ed_1_2')['supp'], 2);
    await tapV(t, find.text('Absent').last);
    expect(row('ed_candidates', 'edc_ed_1_2')['status'], 'absent');
  });

  testWidgets('messages: inbox, unread, open thread, reply, compose, drafts', (t) async {
    await pump(t, RoutePaths.messages);
    expect(find.text('Mrs. Priya Sharma'), findsOneWidget);
    expect(find.text('Unread (2)'), findsOneWidget);
    await tapV(t, find.text('Unread (2)'));
    expect(find.text('Mrs. Priya Sharma'), findsNothing);
    await tapV(t, find.text('Dr. K. V. Rao'));
    expect(row('ms_messages', 'ms_2')['unread'], 0);
    await t.enterText(find.byType(TextField).last, 'Will do, sir');
    await tapV(t, find.byTooltip('Send'));
    expect(row('ms_messages', 'ms_2').l('msgs').last['text'], 'Will do, sir');
    await tapV(t, find.text('Acknowledged 👍'));
    expect(row('ms_messages', 'ms_2').l('msgs').length, 3);
    await tapV(t, find.byTooltip('Attach file'));
    await tapV(t, sem('Browse files'));
    await tapV(t, find.text('Add'));
    expect(row('ms_messages', 'ms_2').l('msgs').last['attach'], isNotNull);

    // compose
    await pump(t, RoutePaths.messageNew);
    await tapV(t, find.text('Send Message'));
    expect(find.text('Select at least one recipient'), findsOneWidget);
    await tapV(t, find.text('Mrs. Priya Sharma'));
    await tapV(t, find.text('Send Message'));
    await t.fling(find.byType(Scrollable).first, const Offset(0, 3000), 5000);
    await t.pumpAndSettle();
    expect(find.text('Write a message before sending'), findsOneWidget);
    await enterBody(t, 'Please bring the worksheet.');
    await tapV(t, find.text('Send Message'));
    expect(row('ms_messages', 'ms_1').l('msgs').last['text'], 'Please bring the worksheet.');

    // save draft + drafts page
    await pump(t, RoutePaths.messageNew);
    await enterBody(t, 'Work in progress');
    await tapV(t, find.text('Save Draft'));
    expect(db.list('ms_drafts').length, 5);
    await pump(t, RoutePaths.messageDrafts);
    expect(find.text('Cloud Auto-Sync Active'), findsOneWidget);
    expect(find.text('All Drafts (5)'), findsOneWidget);
    await tapV(t, find.byTooltip('Delete draft'), which: 0);
    await tapV(t, find.text('Delete').last);
    expect(db.list('ms_drafts').length, 4);
  });
}
