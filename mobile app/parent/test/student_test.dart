import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:parent_app/config/routes/routes.dart';
import 'package:parent_app/design_system/design_system.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/more/screens/more_screen.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_action_bloc.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_bloc.dart';
import 'package:parent_app/modules/ptm/models/ptm_models.dart';
import 'package:parent_app/modules/ptm/repositories/mock_ptm_repository.dart';
import 'package:parent_app/modules/ptm/repositories/ptm_repository_interface.dart';
import 'package:parent_app/modules/student/bloc/certificate_action_bloc.dart';
import 'package:parent_app/modules/student/bloc/student_profile_bloc.dart';
import 'package:parent_app/modules/student/models/certificate_models.dart';
import 'package:parent_app/modules/student/models/student_models.dart';
import 'package:parent_app/modules/student/repositories/mock_student_repository.dart';
import 'package:parent_app/modules/teachers/bloc/teachers_bloc.dart';
import 'package:parent_app/modules/teachers/models/teacher_models.dart';
import 'package:parent_app/modules/teachers/repositories/mock_teachers_repository.dart';
import 'package:parent_app/modules/teachers/repositories/teachers_demo_data.dart';
import 'package:parent_app/utils/services/cache_service.dart';
import 'package:parent_app/utils/services/mock_latency.dart';
import 'helpers/pump_app.dart';

const _aarav = 'stu_aarav';

// ---- helpers ------------------------------------------------------------------------------------

String _loc(WidgetTester t) {
  final cfg = GoRouter.of(
    t.element(find.byType(Scaffold).first),
  ).routerDelegate.currentConfiguration;
  final last = cfg.last;
  return (last is ImperativeRouteMatch ? last.matches.uri : cfg.uri).toString();
}

Future<void> _pop(WidgetTester t) async {
  GoRouter.of(t.element(find.byType(Scaffold).last)).pop();
  await t.pumpAndSettle();
}

/// The page's vertical scrollable (sheets are found first when open, so use [inSheet]).
Finder _vScroll({bool inSheet = false}) {
  final all = find.byWidgetPredicate(
    (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
  );
  return inSheet ? all.last : all.first;
}

Future<void> _show(WidgetTester t, Finder f, {bool inSheet = false}) async {
  await t.scrollUntilVisible(f, 250, scrollable: _vScroll(inSheet: inSheet));
  await t.pumpAndSettle();
}

/// Snackbars cover the bottom action bars; dismiss the current one before the next tap.
void _clearSnack(WidgetTester t) {
  for (final m in t.stateList<ScaffoldMessengerState>(
    find.byType(ScaffoldMessenger),
  )) {
    m.removeCurrentSnackBar();
  }
}

/// Jumps the page's vertical list back to the top (lazy lists drop items scrolled far away).
Future<void> _top(WidgetTester t) async {
  t.state<ScrollableState>(_vScroll()).position.jumpTo(0);
  await t.pumpAndSettle();
}

Future<void> _tap(WidgetTester t, Finder f, {bool scroll = true}) async {
  _clearSnack(t);
  await t.pump();
  if (scroll) await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

Future<List<String>> _chipLabels(WidgetTester t) async {
  await _top(t);
  final w = t.widget<AppSolidChips>(find.byType(AppSolidChips).first);
  return [for (final i in w.items) w.labelOf?.call(i) ?? i];
}

/// Selects the filter chip showing [label] (chips scroll horizontally, so call the control directly).
Future<void> _chip(WidgetTester t, String label) async {
  await _top(t);
  final w = t.widget<AppSolidChips>(find.byType(AppSolidChips).first);
  final item = w.items.firstWhere((i) => (w.labelOf?.call(i) ?? i) == label);
  w.onChanged(item);
  await t.pumpAndSettle();
}

void _mockClipboard(WidgetTester t) {
  t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (call) async => null,
  );
  addTearDown(
    () => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    ),
  );
}

Future<void> _enter(WidgetTester t, Key key, String text) async {
  final f = find.descendant(
    of: find.byKey(key),
    matching: find.byType(TextFormField),
  );
  await t.ensureVisible(f);
  await t.enterText(f, text);
  await t.pumpAndSettle();
}

/// PTM repository with one virtual meeting that is live right now (to exercise Join).
class _LivePtmRepo implements IPtmRepository {
  final joins = <String>[];
  @override
  Stream<PtmData> watchPtm(String childId) => Stream.value(
    PtmData(
      meetings: [
        Meeting(
          id: 'live',
          childId: childId,
          title: 'Live review',
          agenda: 'Happening now',
          teacherId: 'tch_anita',
          teacherName: 'Mrs. Anita Sharma',
          teacherRole: 'Mathematics',
          start: DateTime.now().subtract(const Duration(minutes: 2)),
          mins: 30,
          mode: MeetingMode.virtual,
          location: 'Google Meet',
          link: 'https://meet.google.com/abc-defg-hij',
        ),
      ],
      teachers: TeachersDemoData.forChild(childId).faculty,
      slots: const [],
    ),
  );
  @override
  Future<void> recordJoin({
    required String childId,
    required String meetingId,
  }) async => joins.add(meetingId);
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

void main() {
  setUp(() => MockLatency.delay = Duration.zero);

  // ---- models & repositories ----------------------------------------------------------------------
  group('PTM model and repository', () {
    final start = DateTime(2026, 11, 2, 10, 30);
    final m = Meeting(
      id: 'm',
      childId: _aarav,
      title: 't',
      agenda: 'a',
      teacherId: 'tch_anita',
      teacherName: 'x',
      teacherRole: 'y',
      start: start,
      mins: 30,
      mode: MeetingMode.virtual,
      location: 'Google Meet',
      link: 'https://meet.google.com/abc-defg-hij',
    );

    test('join window: 10 minutes before until the end, virtual only', () {
      expect(m.canJoinAt(start.subtract(const Duration(minutes: 11))), isFalse);
      expect(m.canJoinAt(start.subtract(const Duration(minutes: 10))), isTrue);
      expect(m.canJoinAt(start.add(const Duration(minutes: 29))), isTrue);
      expect(m.canJoinAt(start.add(const Duration(minutes: 30))), isFalse);
      expect(
        m.copyWith(status: MeetingStatus.cancelled).canJoinAt(start),
        isFalse,
      );
      expect(m.isUpcoming(start), isTrue);
      expect(
        m.statusAt(start.add(const Duration(hours: 1))),
        MeetingStatus.attended,
      );
    });

    test(
      'cache-first, book marks the slot taken, reschedule and cancel',
      () async {
        final cache = CacheService();
        final repo = MockPtmRepository(cache);
        final first = await repo.watchPtm(_aarav).first;
        expect(first.upcoming(DateTime.now()), hasLength(1));
        expect(first.past(DateTime.now()), hasLength(2));
        expect(first.teachers, hasLength(6));
        expect(cache.contains('ptm:$_aarav'), isTrue);

        final stream = repo.watchPtm(_aarav);
        final seen = <PtmData>[];
        final sub = stream.listen(seen.add);
        await pumpEventQueue();
        final free = first.slotsOf('tch_imran').firstWhere((s) => !s.booked);
        final m = await repo.book(
          childId: _aarav,
          teacherId: 'tch_imran',
          slotId: free.id,
          mode: MeetingMode.virtual,
          agenda: 'Project marks',
        );
        await pumpEventQueue();
        expect(m.link, startsWith('https://meet.google.com/'));
        final after = seen.last;
        expect(after.upcoming(DateTime.now()), hasLength(2));
        expect(after.slots.firstWhere((s) => s.id == free.id).booked, isTrue);

        await expectLater(
          repo.book(
            childId: _aarav,
            teacherId: 'tch_imran',
            slotId: free.id,
            mode: MeetingMode.inPerson,
            agenda: 'Again please',
          ),
          throwsA(anything),
        );

        final other = after.slotsOf('tch_imran').firstWhere((s) => !s.booked);
        final moved = await repo.reschedule(
          childId: _aarav,
          meetingId: m.id,
          slotId: other.id,
        );
        expect(moved.start, other.start);
        await repo.cancel(childId: _aarav, meetingId: m.id);
        await pumpEventQueue();
        expect(
          seen.last.meetings.firstWhere((x) => x.id == m.id).status,
          MeetingStatus.cancelled,
        );
        expect(
          seen.last.slots.firstWhere((s) => s.id == other.id).booked,
          isFalse,
        );
        // cacheFirst completes a cancel only at its next event, so do not await it.
        unawaited(sub.cancel());
      },
    );
  });

  group('Student repository', () {
    test('profile matches the attendance and marks data', () async {
      final repo = MockStudentRepository(CacheService());
      final p = await repo.watchProfile(_aarav).first;
      final att = DemoData.attendance(_aarav).overall;
      expect(p.present, att.present);
      expect(p.attendancePercent, att.percentage);
      expect(p.cgpa, isNotNull);
      expect(p.guardians.first.primary, isTrue);
      expect(p.academicYear, academicYearOf(DateTime.now()));
      expect(academicYearOf(DateTime(2026, 3, 1)), '2025-26');
      expect(academicYearOf(DateTime(2026, 4, 1)), '2026-27');
    });

    test('download records, request adds a pending certificate', () async {
      final repo = MockStudentRepository(CacheService());
      final seen = <List<Certificate>>[];
      final sub = repo.watchCertificates(_aarav).listen(seen.add);
      await pumpEventQueue();
      expect(seen.last, hasLength(6));
      await repo.recordDownload(childId: _aarav, certificateId: 'crt_a1');
      await pumpEventQueue();
      expect(
        seen.last.firstWhere((c) => c.id == 'crt_a1').downloadedAt,
        isNotNull,
      );
      final c = await repo.requestCertificate(
        childId: _aarav,
        type: CertificateRequestType.character,
        purpose: 'Passport',
      );
      await pumpEventQueue();
      expect(seen.last, hasLength(7));
      expect(c.requested, isTrue);
      await expectLater(
        repo.recordDownload(childId: _aarav, certificateId: c.id),
        throwsA(anything),
      );
      await expectLater(
        repo.requestCertificate(
          childId: _aarav,
          type: CertificateRequestType.character,
          purpose: 'Again',
        ),
        throwsA(anything),
      );
      // cacheFirst completes a cancel only at its next event, so do not await it.
      unawaited(sub.cancel());
    });

    test('teachers follow the timetable and message threads', () async {
      final d = await MockTeachersRepository(
        CacheService(),
      ).watchTeachers(_aarav).first;
      expect(d.classTeacher.name, DemoData.aarav.classTeacher);
      expect(d.classTeacher.threadId, 'th_${_aarav}_ct');
      expect(d.byId('tch_imran')!.threadId, 'th_${_aarav}_st');
      expect(d.countOf(TeacherCategory.languages), 2);
      final n = TeachersDemoData.forChild('stu_ananya');
      expect(n.classTeacher.name, DemoData.ananya.classTeacher);
    });
  });

  group('BLoCs', () {
    setUp(() async => setUpTestApp(signedIn: true));

    test('PtmActionBloc validates the booking form', () async {
      final bloc = getIt<PtmActionBloc>();
      bloc.add(const BookPtm(childId: _aarav));
      final s = await bloc.stream.first;
      expect(s.status, PtmActionStatus.failure);
      expect(s.errors.keys, containsAll(['teacher', 'slot', 'agenda']));
      bloc.add(const ReschedulePtm(childId: _aarav, meetingId: 'x'));
      expect((await bloc.stream.first).errors['slot'], isNotNull);
      await bloc.close();
    });

    test(
      'PtmBloc, TeachersBloc, StudentProfileBloc load for a child',
      () async {
        final ptm = getIt<PtmBloc>()..add(const LoadChildData(_aarav));
        final teachers = getIt<TeachersBloc>()
          ..add(const LoadChildData(_aarav));
        final profile = getIt<StudentProfileBloc>()
          ..add(const LoadChildData(_aarav));
        expect(
          (await ptm.stream.firstWhere((s) => s.hasData)).data!.meetings,
          isNotEmpty,
        );
        expect(
          (await teachers.stream.firstWhere((s) => s.hasData)).data!.faculty,
          hasLength(6),
        );
        expect(
          (await profile.stream.firstWhere((s) => s.hasData)).data!.child.id,
          _aarav,
        );
        await Future.wait([ptm.close(), teachers.close(), profile.close()]);
      },
    );

    test('CertificateActionBloc validates requests and downloads', () async {
      final bloc = getIt<CertificateActionBloc>();
      bloc.add(const RequestCertificate(childId: _aarav));
      final s = await bloc.stream.first;
      expect(s.errors.keys, containsAll(['type', 'purpose']));
      bloc.add(
        const DownloadCertificate(childId: _aarav, certificateId: 'crt_a2'),
      );
      final done = await bloc.stream.firstWhere(
        (s) => s.status == CertificateActionStatus.success,
      );
      expect(done.certificate!.downloadedAt, isNotNull);
      await bloc.close();
    });
  });

  // ---- screens ------------------------------------------------------------------------------------
  testWidgets('More: every hub link opens its screen, sign out', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t, location: RoutePaths.more);
    expect(find.text('Aarav Sharma'), findsWidgets);
    for (final l in [
      ...moreStudentLinks,
      ...moreClassLinks,
      ...moreAccountLinks,
    ]) {
      final f = find.byKey(Key('more-${l.route}'));
      await _show(t, f);
      await _tap(t, f);
      expect(_loc(t), l.route, reason: l.title);
      await _pop(t);
      expect(_loc(t), RoutePaths.more);
    }
    // child card -> student profile
    await _top(t);
    await _tap(t, find.text('VIEWING'));
    expect(_loc(t), RoutePaths.studentProfile);
    await _pop(t);
    // sign out (cancel first, then confirm)
    final out = find.byKey(const Key('more-sign-out'));
    await _show(t, out);
    await _tap(t, out);
    await _tap(t, find.text('Cancel'), scroll: false);
    expect(_loc(t), RoutePaths.more);
    await _tap(t, out);
    await _tap(t, find.text('Sign out').last, scroll: false);
    expect(RoutePaths.isPublic(_loc(t)), isTrue, reason: 'signed out');
  });

  testWidgets('Student profile: identity, switch child, links and actions', (
    t,
  ) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t, location: RoutePaths.studentProfile);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text('Class 10-B • Roll #14'), findsOneWidget);
    expect(find.text('Ashoka House • House Captain'), findsOneWidget);
    expect(find.byKey(const Key('profile-attendance')), findsOneWidget);

    // header actions
    await _tap(t, find.byTooltip('My profile'), scroll: false);
    expect(_loc(t), RoutePaths.profile);
    await _pop(t);
    await _tap(t, find.byTooltip('Notifications'), scroll: false);
    expect(_loc(t), RoutePaths.notifications);
    await _pop(t);

    // attendance card -> Academics attendance; CGPA -> marks
    await _tap(t, find.byKey(const Key('profile-attendance')));
    expect(_loc(t), RoutePaths.academicsSection('attendance'));
    GoRouter.of(
      t.element(find.byType(Scaffold).first),
    ).go(RoutePaths.studentProfile);
    await t.pumpAndSettle();
    await _tap(t, find.text('Merit Points & Honors'));
    expect(_loc(t), RoutePaths.behaviour);
    await _pop(t);
    await _tap(t, find.widgetWithText(ActionChip, 'Timetable'));
    expect(_loc(t), RoutePaths.academicsSection('timetable'));
    GoRouter.of(
      t.element(find.byType(Scaffold).first),
    ).go(RoutePaths.studentProfile);
    await t.pumpAndSettle();

    // honours sheet -> certificates
    await _show(t, find.text('View All'));
    await _tap(t, find.text('View All'));
    expect(find.text('Badges & Honors'), findsOneWidget);
    await _tap(t, find.text('View Certificates'));
    expect(_loc(t), RoutePaths.certificates);
    await _pop(t);

    // teachers link, medical calls, transport, guardians, documents
    await _show(t, find.text('View all teachers'));
    await _tap(t, find.text('View all teachers'));
    expect(_loc(t), RoutePaths.teachers);
    await _pop(t);
    await _show(t, find.byTooltip('Call Dr. Meera Kapoor'));
    await _tap(t, find.byTooltip('Call Dr. Meera Kapoor'));
    expect(find.textContaining('Calling Dr. Meera Kapoor'), findsOneWidget);
    await _tap(t, find.byTooltip('Call Sunita Sharma').first);
    expect(find.textContaining('Calling Sunita Sharma'), findsOneWidget);
    await _show(t, find.text('LIVE GPS'));
    await _tap(t, find.text('LIVE GPS'));
    expect(_loc(t), RoutePaths.trackLive);
    await _pop(t);
    await _show(t, find.byTooltip('Call Mahesh Singh'));
    await _tap(t, find.byTooltip('Call Mahesh Singh'));
    expect(find.textContaining('Calling Mahesh Singh'), findsOneWidget);
    await _show(t, find.text('Update'));
    await _tap(t, find.text('Update'));
    expect(_loc(t), RoutePaths.editProfile);
    await _pop(t);
    await _show(t, find.text('Birth_Certificate.pdf'));
    await _tap(t, find.text('Birth_Certificate.pdf'));
    expect(find.textContaining('Opened Birth_Certificate.pdf'), findsOneWidget);
    await _tap(t, find.text('Certificates').last);
    expect(_loc(t), RoutePaths.certificates);
    await _pop(t);

    // dossier
    await _tap(
      t,
      find.text('Download Full Student Dossier (PDF)'),
      scroll: false,
    );
    expect(find.textContaining('_Dossier_'), findsOneWidget);

    // switch child
    await t.scrollUntilVisible(
      find.text('Switch Profile'),
      -300,
      scrollable: _vScroll(),
    );
    await _tap(t, find.text('Switch Profile'));
    await _tap(t, find.text('Ananya Sharma').last, scroll: false);
    expect(find.text('Class 8-C • Roll #27'), findsOneWidget);
    expect(find.text('Tagore House • Cultural Prefect'), findsOneWidget);
  });

  testWidgets(
    'Certificates: filter, search, sort, preview, download, share, request',
    (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.certificates);
      expect(await _chipLabels(t), contains('All (6)'));
      expect(await _chipLabels(t), contains('Academic & Merit (3)'));
      expect(find.text('Academic Excellence Award'), findsWidgets);

      // category filter
      await _chip(t, 'Sports & Extra (1)');
      expect(find.text('Inter-House Athletics - 400 m Silver'), findsWidgets);
      expect(find.text('Academic Excellence Award'), findsNothing);
      await _chip(t, 'All (6)');

      // search + empty + clear
      await t.enterText(find.byType(TextField).first, 'olympiad');
      await t.pumpAndSettle();
      expect(
        find.text('Junior Mathematics Olympiad Certificate'),
        findsWidgets,
      );
      expect(find.text('Academic Excellence Award'), findsNothing);
      await t.enterText(find.byType(TextField).first, 'zzz');
      await t.pumpAndSettle();
      expect(find.text('No certificates found'), findsOneWidget);
      await _tap(t, find.text('Clear filters'));
      expect(find.text('Academic Excellence Award'), findsWidgets);

      // sort
      await _tap(t, find.byTooltip('Sort certificates'), scroll: false);
      await _tap(t, find.text('Title (A-Z)'), scroll: false);
      expect(find.text('Academic Excellence Award'), findsWidgets);

      // preview -> share, preview -> download
      await _tap(t, find.text('Preview').first);
      expect(find.text('ISSUED BY'), findsOneWidget);
      await _tap(t, find.text('Share'));
      expect(find.textContaining('Share sheet opened'), findsOneWidget);
      await _tap(t, find.text('Preview').first);
      await _tap(t, find.widgetWithText(FilledButton, 'Download').last);
      expect(
        find.textContaining('saved to Downloads (simulated)'),
        findsOneWidget,
      );
      expect(find.text('Downloaded'), findsOneWidget);

      // card download
      await _tap(t, find.widgetWithText(FilledButton, 'Download').at(1));
      expect(
        find.textContaining('saved to Downloads (simulated)'),
        findsOneWidget,
      );
      expect(find.text('Downloaded'), findsWidgets);

      // request: validation then submit
      await _tap(t, find.text('Request a Certificate'), scroll: false);
      await _tap(t, find.text('Submit Request'));
      expect(find.text('Choose the certificate you need.'), findsOneWidget);
      expect(find.textContaining('Tell the office'), findsOneWidget);
      await _tap(t, find.byKey(const Key('cert-type')));
      await _tap(t, find.text('Transfer Certificate'), scroll: false);
      await _enter(t, const Key('cert-purpose'), 'Admission to a new school');
      await _tap(t, find.text('Submit Request'));
      expect(
        find.textContaining('Transfer Certificate requested'),
        findsOneWidget,
      );
      expect(await _chipLabels(t), contains('All (7)'));
      await _show(t, find.text('Processing'));
      expect(find.text('Processing'), findsOneWidget);
    },
  );

  testWidgets(
    'PTM: tabs, join rule, copy, minutes, message, book, reschedule',
    (t) async {
      _mockClipboard(t);
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.ptm);
      expect(await _chipLabels(t), contains('All Meetings (3)'));
      expect(
        find.text('Term 2 Academic Review & Pre-Board Road Map'),
        findsOneWidget,
      );

      // tabs
      await _chip(t, 'Past Meetings (2)');
      expect(
        find.text('Term 2 Academic Review & Pre-Board Road Map'),
        findsNothing,
      );
      expect(find.text('Class 10 Annual Orientation'), findsOneWidget);
      // minutes sheet + download
      await _tap(t, find.text('View Minutes (PDF)').first);
      expect(find.text('Meeting Minutes'), findsOneWidget);
      await _tap(t, find.text('Download PDF'));
      expect(find.textContaining('_Minutes.pdf saved'), findsOneWidget);
      await _chip(t, 'Upcoming (1)');
      expect(find.text('Class 10 Annual Orientation'), findsNothing);
      await _chip(t, 'All Meetings (3)');

      // join is not open yet (tomorrow), copy link works
      await _tap(t, find.text('Join Meeting'));
      expect(
        find.textContaining('Join opens 10 minutes before'),
        findsOneWidget,
      );
      await _tap(t, find.text('Copy Meeting Link'));
      expect(find.text('Meeting link copied'), findsOneWidget);

      // message the teacher
      await _tap(t, find.byTooltip('Message Mrs. Anita Sharma'));
      expect(_loc(t), startsWith('/messages/thread/th_${_aarav}_ct'));
      await _pop(t);

      // book: validation, then a real booking
      await _tap(t, find.text('Book a Meeting'), scroll: false);
      await _tap(t, find.text('Confirm Booking'));
      expect(find.text('Choose a teacher.'), findsOneWidget);
      expect(find.textContaining('Describe what you want'), findsOneWidget);
      await _tap(t, find.byKey(const Key('ptm-teacher')));
      await _tap(t, find.text('Mr. Imran Khan').last, scroll: false);
      await _tap(t, find.text('Confirm Booking'));
      expect(find.text('Choose a time slot.'), findsOneWidget);
      await _tap(t, find.text('3:20 PM'));
      await _tap(t, find.text('Virtual'));
      await _enter(t, const Key('ptm-agenda'), 'Discuss the CS project');
      await _tap(t, find.text('Confirm Booking'));
      expect(
        find.textContaining('Meeting booked with Mr. Imran Khan'),
        findsOneWidget,
      );
      expect(await _chipLabels(t), contains('Upcoming (2)'));

      // reschedule the first meeting
      await _tap(t, find.text('Reschedule').first);
      expect(find.text('Reschedule Meeting'), findsOneWidget);
      await _tap(t, find.text('Confirm New Time'));
      expect(find.text('Choose a new time slot.'), findsOneWidget);
      await _tap(t, find.text('3:20 PM'));
      await _tap(t, find.text('Confirm New Time'));
      expect(find.textContaining('Meeting moved'), findsOneWidget);
    },
  );

  testWidgets('PTM: cancel a meeting', (t) async {
    await setUpTestApp(signedIn: true);
    await pumpApp(t, location: RoutePaths.ptm);
    await _tap(t, find.widgetWithText(TextButton, 'Cancel'));
    expect(find.text('Cancel this meeting?'), findsOneWidget);
    await _tap(t, find.text('Cancel meeting'), scroll: false);
    expect(find.text('Meeting cancelled'), findsOneWidget);
    expect(await _chipLabels(t), contains('Upcoming (0)'));
    expect(find.text('No upcoming meetings'), findsOneWidget);
    await _show(t, find.text('Cancelled'));
    expect(find.text('Cancelled'), findsOneWidget);
  });

  testWidgets(
    'PTM: join opens the Meet link when live (and copies on failure)',
    (t) async {
      _mockClipboard(t);
      final launcher = await setUpTestApp(signedIn: true);
      final repo = _LivePtmRepo();
      getIt.unregister<IPtmRepository>();
      getIt.registerSingleton<IPtmRepository>(repo);
      await pumpApp(t, location: RoutePaths.ptm);
      await _tap(t, find.text('Join Meeting'));
      expect(launcher.opened, ['https://meet.google.com/abc-defg-hij']);
      expect(repo.joins, ['live']);
    },
  );

  testWidgets(
    'PTM: join falls back to copying the link when Meet cannot open',
    (t) async {
      _mockClipboard(t);
      final failing = await setUpTestApp(
        signedIn: true,
        launcherSucceeds: false,
      );
      getIt.unregister<IPtmRepository>();
      getIt.registerSingleton<IPtmRepository>(_LivePtmRepo());
      await pumpApp(t, location: RoutePaths.ptm);
      await _tap(t, find.text('Join Meeting'));
      expect(failing.opened, hasLength(1));
      expect(find.textContaining('Could not open Google Meet'), findsOneWidget);
    },
  );

  testWidgets(
    'Teachers: class teacher, filter, search, sort, call, message, book PTM',
    (t) async {
      await setUpTestApp(signedIn: true);
      await pumpApp(t, location: RoutePaths.teachers);
      expect(find.text('Mrs. Anita Sharma, M.Sc.'), findsOneWidget);
      expect(find.text('6 Active'), findsOneWidget);
      expect(await _chipLabels(t), contains('All (6)'));
      expect(find.text('Academic instructors for Class 10-B'), findsOneWidget);

      // filter chips
      await _chip(t, 'Languages (2)');
      expect(find.text('Ms. Priya Menon'), findsOneWidget);
      expect(find.text('Mr. Imran Khan'), findsNothing);
      await _chip(t, 'All (6)');

      // search + clear
      await t.enterText(find.byType(TextField).first, 'computer');
      await t.pumpAndSettle();
      expect(find.text('Mr. Imran Khan'), findsOneWidget);
      expect(find.text('Ms. Priya Menon'), findsNothing);
      await t.enterText(find.byType(TextField).first, 'zzz');
      await t.pumpAndSettle();
      expect(find.text('No teachers match'), findsOneWidget);
      await _tap(t, find.text('Clear filters'));
      expect(find.text('Ms. Priya Menon'), findsOneWidget);

      // sort sheet
      await _tap(t, find.byTooltip('Sort teachers'), scroll: false);
      await _tap(t, find.text('Subject'), scroll: false);

      // row message button -> chat thread
      await _tap(t, find.byTooltip('Message Mr. Imran Khan'));
      expect(_loc(t), startsWith('/messages/thread/th_${_aarav}_st'));
      await _pop(t);

      // detail sheet: call, message, book PTM
      await _tap(t, find.text('Mr. Imran Khan'));
      expect(find.text('OFFICE HOURS'), findsOneWidget);
      await _tap(t, find.text('Call'));
      expect(find.textContaining('Calling Mr. Imran Khan'), findsOneWidget);
      await _tap(t, find.text('Ms. Priya Menon'));
      await _tap(t, find.text('Message'));
      expect(_loc(t), startsWith('/messages/thread/th_${_aarav}_tch_priya'));
      await _pop(t);
      await _tap(t, find.text('Mr. Imran Khan'));
      await _tap(t, find.text('Book PTM'));
      expect(_loc(t), RoutePaths.ptmWith('tch_imran'));
      expect(find.text('Book a Meeting'), findsWidgets);
      expect(find.text('Mr. Imran Khan'), findsOneWidget);
      Navigator.of(t.element(find.byKey(const Key('ptm-teacher')))).pop();
      await t.pumpAndSettle();
      await _pop(t);

      // class teacher card message + directory help
      await _tap(
        t,
        find.byTooltip('Message Mrs. Anita Sharma').first,
        scroll: false,
      );
      expect(_loc(t), startsWith('/messages/thread/th_${_aarav}_ct'));
      await _pop(t);
      await _show(t, find.text('Directory Help'));
      await _tap(t, find.text('Directory Help'));
      await _tap(t, find.text('Call Reception'));
      expect(find.textContaining('Calling Reception'), findsOneWidget);

      // follows the child switcher
      await t.scrollUntilVisible(
        find.text('Subject Faculty'),
        -300,
        scrollable: _vScroll(),
      );
      await _tap(
        t,
        find.byKey(const ValueKey('child-chip-stu_ananya')),
        scroll: false,
      );
      expect(find.text('Mr. Vikram Nair, M.Lib.'), findsOneWidget);
      expect(find.text('Academic instructors for Class 8-C'), findsOneWidget);
    },
  );
}
