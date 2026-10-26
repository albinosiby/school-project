import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/attendance/models/attendance_models.dart';
import 'package:parent_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:parent_app/modules/homework/repositories/homework_repository_interface.dart';
import 'package:parent_app/modules/home/repositories/home_repository.dart';
import 'package:parent_app/modules/live_classes/repositories/live_class_repository_interface.dart';
import 'package:parent_app/modules/notices/repositories/notice_repository_interface.dart';
import 'package:parent_app/modules/timetable/repositories/timetable_repository_interface.dart';
import 'package:parent_app/modules/transport/repositories/transport_repository_interface.dart';
import 'package:parent_app/modules/leave/models/leave_models.dart';
import 'package:parent_app/modules/leave/repositories/leave_repository_interface.dart';
import 'package:parent_app/modules/leave/bloc/leave_apply_bloc.dart';
import 'package:parent_app/modules/messages/bloc/chat_bloc.dart';
// ignore: unnecessary_import
import 'package:parent_app/core/bloc/child_data_bloc.dart' show LoadStatus;
import 'package:parent_app/utils/services/cache_service.dart';
import 'helpers/pump_app.dart';

HomeRepository _repo(DateTime now) => HomeRepository(
  cache: CacheService(),
  timetable: getIt<ITimetableRepository>(),
  attendance: getIt<IAttendanceRepository>(),
  homework: getIt<IHomeworkRepository>(),
  notices: getIt<INoticeRepository>(),
  liveClasses: getIt<ILiveClassRepository>(),
  transport: getIt<ITransportRepository>(),
  clock: () => now,
);

void main() {
  setUp(() => setUpTestApp(signedIn: true));

  test(
    'weekday: periods, attendance, homework due and the next live class',
    () async {
      final tuesday = DateTime(
        2026,
        10,
        27,
        10,
        0,
      ); // a Tuesday; the demo data is relative to the real clock
      expect(tuesday.weekday, DateTime.tuesday);
      final s = await _repo(tuesday).watchToday(DemoData.aarav.id).first;
      expect(s.isSchoolDay, isTrue);
      expect(s.periods, hasLength(7));
      expect(s.periods.every((p) => p.weekday == DateTime.tuesday), isTrue);
      expect(s.notices, hasLength(3));
      expect(s.notices.first.needsAction, isTrue); // actions first
      expect(s.homeworkDue.every((h) => !h.submitted), isTrue);
      expect(
        s.homeworkInReview.every((h) => h.submitted && !h.reviewed),
        isTrue,
      );
      expect(s.termAttendance, inInclusiveRange(0, 100));
      expect(s.bus, isNotNull);
      expect(s.bus!.busNo, '14');
    },
  );

  test('gate entry only when the child is marked present today', () async {
    final now = DateTime.now();
    final aarav = await _repo(now).watchToday(DemoData.aarav.id).first;
    final ananya = await _repo(now).watchToday(DemoData.ananya.id).first;
    if (now.weekday <= DateTime.friday) {
      expect(aarav.gateEntry?.gate, 'Gate 2 North');
    }
    expect(ananya.gateEntry, isNull); // not marked yet
  });

  test('weekend is not a school day and has no periods', () async {
    final saturday = DateTime(2026, 10, 24, 10, 0);
    expect(saturday.weekday, DateTime.saturday);
    final s = await _repo(saturday).watchToday(DemoData.aarav.id).first;
    expect(s.isSchoolDay, isFalse);
    expect(s.periods, isEmpty);
    expect(s.bus, isNull); // no school bus at the weekend
  });

  test('Ananya has no attendance mark for today', () async {
    final data = DemoData.attendance(DemoData.ananya.id);
    expect(data.on(DateTime.now()), isNull);
    expect(
      DemoData.attendance(
        DemoData.aarav.id,
      ).records.any((r) => r.status == AttendanceStatus.absent),
      isTrue,
    );
  });

  group('LeaveApplyBloc', () {
    test('requires a reason and a sensible date range', () async {
      final bloc = getIt<LeaveApplyBloc>();
      final d = DateTime(2026, 11, 3);
      bloc.add(LeaveApplyEvent(childId: 'c', from: d, to: d, reason: '  '));
      expect(
        (await bloc.stream.firstWhere(
          (s) => s.status == ApplyStatus.failure,
        )).error,
        contains('reason'),
      );
      bloc.add(
        LeaveApplyEvent(
          childId: 'c',
          from: d,
          to: d.subtract(const Duration(days: 1)),
          reason: 'x',
        ),
      );
      expect(
        (await bloc.stream.firstWhere(
          (s) => s.error?.contains('end date') ?? false,
        )).status,
        ApplyStatus.failure,
      );
    });

    test('rejects weekend-only dates and leave beyond the balance', () async {
      final bloc = getIt<LeaveApplyBloc>();
      final sat = DateTime(2026, 10, 31);
      bloc.add(
        LeaveApplyEvent(
          childId: 'c',
          from: sat,
          to: sat.add(const Duration(days: 1)),
          reason: 'Trip',
        ),
      );
      final weekend = await bloc.stream.firstWhere(
        (s) => s.status == ApplyStatus.failure,
      );
      expect(weekend.field, LeaveField.dates);
      expect(weekend.error, contains('weekend'));
      final mon = DateTime(2026, 11, 2);
      bloc.add(
        LeaveApplyEvent(
          childId: 'c',
          from: mon,
          to: mon.add(const Duration(days: 4)),
          reason: 'Fever',
          type: LeaveType.medical,
          daysLeft: 3,
        ),
      );
      final balance = await bloc.stream.firstWhere(
        (s) => s.field == LeaveField.balance,
      );
      expect(balance.error, 'Only 3 medical leave days left this year.');
    });

    test('a valid application succeeds', () async {
      final bloc = getIt<LeaveApplyBloc>();
      final d = DateTime(2026, 11, 3);
      bloc.add(
        LeaveApplyEvent(
          childId: DemoData.aarav.id,
          from: d,
          to: d.add(const Duration(days: 1)),
          reason: 'Wedding',
        ),
      );
      await bloc.stream.firstWhere((s) => s.status == ApplyStatus.success);
    });
  });

  group('leave overview', () {
    test('balances, attendance projection and new applications', () async {
      final repo = getIt<ILeaveRepository>();
      final stream = repo.watchOverview(DemoData.aarav.id).asBroadcastStream();
      final ov = await stream.first;
      expect(ov.left(LeavePool.medical), 5);
      // The approved family function uses casual days (school days only); the rejected one does not.
      final approved = DemoData.leaves(
        DemoData.aarav.id,
      ).firstWhere((r) => r.status == LeaveStatus.approved);
      expect(ov.left(LeavePool.casual), 5 - approved.workingDays);
      expect(ov.workingDays, greaterThan(0));
      expect(ov.projectedPct(2), lessThan(ov.currentPct));
      expect(ov.projectedPct(0), closeTo(ov.currentPct, 1e-9));
      final mon = DateTime(2026, 11, 2);
      await repo.apply(
        childId: DemoData.aarav.id,
        from: mon,
        to: mon.add(const Duration(days: 1)),
        reason: 'Viral fever',
        type: LeaveType.medical,
        attachment: 'doctor_slip.pdf',
      );
      final after = await stream.firstWhere(
        (o) => o.left(LeavePool.medical) == 3,
      );
      expect(after.latest?.attachment, 'doctor_slip.pdf');
      expect(after.latest?.type, LeaveType.medical);
    });

    test('working days skip weekends', () {
      expect(
        workingDaysBetween(DateTime(2026, 10, 30), DateTime(2026, 11, 2)),
        2,
      );
      expect(
        workingDaysBetween(DateTime(2026, 10, 31), DateTime(2026, 11, 1)),
        0,
      );
    });
  });

  test('ChatBloc sends and shows the new message', () async {
    final bloc = getIt<ChatBloc>()..add(const OpenChat('th_stu_aarav_ct'));
    final loaded = await bloc.stream.firstWhere(
      (s) => s.status == LoadStatus.loaded,
    );
    final before = loaded.messages.length;
    bloc.add(const SendChatMessage('  Hello  '));
    final s = await bloc.stream.firstWhere(
      (s) => s.messages.length == before + 1,
    );
    expect(s.messages.last.text, 'Hello');
    expect(s.messages.last.fromParent, isTrue);
    bloc.add(const SendChatMessage('   ')); // blank messages are ignored
    await Future<void>.delayed(Duration.zero);
    expect(bloc.state.messages.length, before + 1);
  });
}
