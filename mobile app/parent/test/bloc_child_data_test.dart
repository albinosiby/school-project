import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/bloc/child_data_bloc.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/di/injection.dart';
import 'package:parent_app/modules/attendance/bloc/attendance_bloc.dart';
import 'package:parent_app/modules/attendance/models/attendance_models.dart';
import 'package:parent_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:parent_app/modules/behaviour/bloc/behaviour_bloc.dart';
import 'package:parent_app/modules/behaviour/models/behaviour_models.dart';
import 'package:parent_app/modules/behaviour/repositories/behaviour_repository_interface.dart';
import 'package:parent_app/modules/fees/bloc/fees_bloc.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/fees/repositories/fee_repository_interface.dart';
import 'package:parent_app/modules/home/bloc/home_bloc.dart';
import 'package:parent_app/modules/home/models/home_models.dart';
import 'package:parent_app/modules/home/repositories/home_repository_interface.dart';
import 'package:parent_app/modules/homework/bloc/homework_bloc.dart';
import 'package:parent_app/modules/homework/models/homework_models.dart';
import 'package:parent_app/modules/homework/repositories/homework_repository_interface.dart';
import 'package:parent_app/modules/leave/bloc/leave_bloc.dart';
import 'package:parent_app/modules/leave/bloc/leave_overview_bloc.dart';
import 'package:parent_app/modules/leave/models/leave_models.dart';
import 'package:parent_app/modules/leave/repositories/leave_repository_interface.dart';
import 'package:parent_app/modules/live_classes/bloc/live_classes_bloc.dart';
import 'package:parent_app/modules/live_classes/models/live_class_models.dart';
import 'package:parent_app/modules/live_classes/repositories/live_class_repository_interface.dart';
import 'package:parent_app/modules/marks/bloc/marks_bloc.dart';
import 'package:parent_app/modules/marks/models/marks_models.dart';
import 'package:parent_app/modules/marks/repositories/marks_repository_interface.dart';
import 'package:parent_app/modules/messages/bloc/messages_bloc.dart';
import 'package:parent_app/modules/messages/models/message_models.dart';
import 'package:parent_app/modules/messages/repositories/message_repository_interface.dart';
import 'package:parent_app/modules/notices/bloc/notices_bloc.dart';
import 'package:parent_app/modules/notices/models/notice_models.dart';
import 'package:parent_app/modules/notices/repositories/notice_repository_interface.dart';
import 'package:parent_app/modules/ptm/bloc/ptm_bloc.dart';
import 'package:parent_app/modules/ptm/models/ptm_models.dart';
import 'package:parent_app/modules/ptm/repositories/ptm_repository_interface.dart';
import 'package:parent_app/modules/student/bloc/certificates_bloc.dart';
import 'package:parent_app/modules/student/bloc/student_profile_bloc.dart';
import 'package:parent_app/modules/student/models/certificate_models.dart';
import 'package:parent_app/modules/student/models/student_models.dart';
import 'package:parent_app/modules/student/repositories/student_repository_interface.dart';
import 'package:parent_app/modules/teachers/bloc/teachers_bloc.dart';
import 'package:parent_app/modules/teachers/models/teacher_models.dart';
import 'package:parent_app/modules/teachers/repositories/teachers_repository_interface.dart';
import 'package:parent_app/modules/timetable/bloc/timetable_bloc.dart';
import 'package:parent_app/modules/timetable/models/timetable_models.dart';
import 'package:parent_app/modules/timetable/repositories/timetable_repository_interface.dart';
import 'package:parent_app/utils/exceptions/app_exception.dart';
import 'helpers/pump_app.dart';

/// Module (BLoC-level) tests for every per-child data BLoC built on [ChildDataBloc]:
/// loading -> loaded, cache-first then fresh, error only without cache, child switching, refresh / retry,
/// and the write events each BLoC forwards to its repository. Repositories are hand-written fakes whose
/// streams the test drives; sample values come from the demo (mock) repositories.

/// A controllable repository stream: every subscription gets its own controller.
class Feed<T> {
  final List<String> calls = [];
  final List<StreamController<T>> controllers = [];

  Stream<T> call(String childId) {
    calls.add(childId);
    final c = StreamController<T>();
    controllers.add(c);
    return c.stream;
  }

  StreamController<T> get last => controllers.last;
}

Future<void> _tick() => Future<void>.delayed(const Duration(milliseconds: 5));

const _c1 = 'stu_c1', _c2 = 'stu_c2';

void childDataSuite<T extends Object>(
  String name,
  ChildDataBloc<T> Function(Feed<T> feed) make,
  Future<(T, T)> Function() samples,
) {
  group('$name (ChildDataBloc)', () {
    late Feed<T> feed;
    late ChildDataBloc<T> bloc;
    late T a, b;

    setUp(() async {
      await setUpTestApp(signedIn: true);
      (a, b) = await samples();
      feed = Feed<T>();
      bloc = make(feed);
    });
    tearDown(() => bloc.close());

    test('sample values differ (precondition)', () => expect(a == b, isFalse));

    test('starts loading, then shows the loaded data of the requested child', () async {
      expect(bloc.state.status, LoadStatus.loading);
      expect(bloc.state.data, isNull);
      bloc.add(const LoadChildData(_c1));
      await _tick();
      expect(feed.calls, [_c1]);
      expect(bloc.state, DataState<T>(childId: _c1));
      feed.last.add(a);
      await _tick();
      expect(bloc.state, DataState<T>(status: LoadStatus.loaded, data: a, childId: _c1));
    });

    test('cache-first: the cached value shows at once, then the fresh value replaces it', () async {
      final states = <DataState<T>>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last
        ..add(a) // cached
        ..add(b); // fresh
      await _tick();
      await sub.cancel();
      expect(states.map((s) => s.status), [LoadStatus.loading, LoadStatus.loaded, LoadStatus.loaded]);
      expect(states[1].data, a);
      expect(states[2].data, b);
    });

    test('an error with nothing cached shows the error message', () async {
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last.addError(AppException(message: 'You are offline.'));
      await _tick();
      expect(bloc.state.status, LoadStatus.error);
      expect(bloc.state.error, 'You are offline.');
      expect(bloc.state.childId, _c1);
    });

    test('an unexpected error shows the generic message', () async {
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last.addError(StateError('boom'));
      await _tick();
      expect(bloc.state.error, 'Something went wrong. Please try again.');
    });

    test('a failed refresh keeps the cached data (no error state)', () async {
      final states = <DataState<T>>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last
        ..add(a)
        ..addError(AppException(message: 'Server down'));
      await _tick();
      await sub.cancel();
      expect(states.any((s) => s.hasError), isFalse);
      expect(bloc.state.status, LoadStatus.loaded);
      expect(bloc.state.data, a);
    });

    test('switching child drops the previous data and loads the new child', () async {
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last.add(a);
      await _tick();
      bloc.add(const LoadChildData(_c2));
      await _tick();
      expect(feed.calls, [_c1, _c2]);
      expect(bloc.state, DataState<T>(childId: _c2));
      expect(feed.controllers.first.hasListener, isFalse, reason: 'the first child stream is cancelled');
      feed.last.add(b);
      await _tick();
      expect(bloc.state.data, b);
      expect(bloc.state.childId, _c2);
    });

    test('refresh re-subscribes for the same child and keeps the data on screen meanwhile', () async {
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last.add(a);
      await _tick();
      final states = <DataState<T>>[];
      final sub = bloc.stream.listen(states.add);
      bloc.add(const RefreshChildData());
      await _tick();
      expect(feed.calls, [_c1, _c1]);
      expect(states.where((s) => s.isLoading), isEmpty);
      expect(bloc.state.data, a);
      feed.last.add(b);
      await _tick();
      await sub.cancel();
      expect(bloc.state.data, b);
    });

    test('refresh before any load does nothing', () async {
      bloc.add(const RefreshChildData());
      await _tick();
      expect(feed.calls, isEmpty);
    });

    test('retry after an error loads again', () async {
      bloc.add(const LoadChildData(_c1));
      await _tick();
      feed.last.addError(AppException(message: 'Offline'));
      await _tick();
      expect(bloc.state.hasError, isTrue);
      bloc.add(const LoadChildData(_c1));
      await _tick();
      expect(bloc.state.isLoading, isTrue);
      feed.last.add(a);
      await _tick();
      expect(bloc.state.data, a);
      expect(bloc.state.error, isNull);
    });
  });
}

// ---------------------------------------------------------------- fakes (only the stream under test is real)

class _Attendance implements IAttendanceRepository {
  _Attendance(this.f);
  final Feed<AttendanceData> f;
  @override
  Stream<AttendanceData> watchAttendance(String childId) => f(childId);
}

class _Homework implements IHomeworkRepository {
  _Homework(this.f);
  final Feed<List<Homework>> f;
  @override
  Stream<List<Homework>> watchHomework(String childId) => f(childId);
}

class _Marks implements IMarksRepository {
  _Marks(this.f);
  final Feed<List<ExamResult>> f;
  @override
  Stream<List<ExamResult>> watchExams(String childId) => f(childId);
}

class _Timetable implements ITimetableRepository {
  _Timetable(this.f);
  final Feed<TimetableWeek> f;
  @override
  Stream<TimetableWeek> watchWeek(String childId) => f(childId);
}

class _Home implements IHomeRepository {
  _Home(this.f);
  final Feed<HomeSummary> f;
  @override
  Stream<HomeSummary> watchToday(String childId) => f(childId);
}

class _Teachers implements ITeachersRepository {
  _Teachers(this.f);
  final Feed<TeachersData> f;
  @override
  Stream<TeachersData> watchTeachers(String childId) => f(childId);
}

class _Fees implements IFeeRepository {
  _Fees(this.f);
  final Feed<FeesData> f;
  @override
  Stream<FeesData> watchFees(String childId) => f(childId);
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Leave implements ILeaveRepository {
  _Leave({this.leaves, this.overview});
  final Feed<List<LeaveRequest>>? leaves;
  final Feed<LeaveOverview>? overview;
  @override
  Stream<List<LeaveRequest>> watchLeaves(String childId) => leaves!(childId);
  @override
  Stream<LeaveOverview> watchOverview(String childId) => overview!(childId);
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Student implements IStudentRepository {
  _Student({this.profile, this.certificates});
  final Feed<StudentProfile>? profile;
  final Feed<List<Certificate>>? certificates;
  @override
  Stream<StudentProfile> watchProfile(String childId) => profile!(childId);
  @override
  Stream<List<Certificate>> watchCertificates(String childId) => certificates!(childId);
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Ptm implements IPtmRepository {
  _Ptm(this.f);
  final Feed<PtmData> f;
  @override
  Stream<PtmData> watchPtm(String childId) => f(childId);
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Notices implements INoticeRepository {
  _Notices(this.f);
  final Feed<List<Notice>> f;
  final List<String> acked = [];
  @override
  Stream<List<Notice>> watchNotices(String childId) => f(childId);
  @override
  Future<void> acknowledge(String noticeId) async => acked.add(noticeId);
}

class _Live implements ILiveClassRepository {
  _Live(this.f);
  final Feed<List<LiveClass>> f;
  final List<String> joins = [];
  @override
  Stream<List<LiveClass>> watchLiveClasses(String childId) => f(childId);
  @override
  Future<void> recordJoin(String classId) async => joins.add(classId);
}

class _Behaviour implements IBehaviourRepository {
  _Behaviour(this.f);
  final Feed<BehaviourReport> f;
  final List<(String, String, String?)> acks = [];
  @override
  Stream<BehaviourReport> watchReport(String childId) => f(childId);
  @override
  Future<void> acknowledge(String childId, String entryId, {String? note}) async => acks.add((childId, entryId, note));
}

class _Messages implements IMessageRepository {
  _Messages({this.overview, this.unread});
  final Feed<MessagesOverview>? overview;
  final Feed<int>? unread;
  final List<String> log = [];
  @override
  Stream<MessagesOverview> watchOverview(String childId) => overview!(childId);
  @override
  Stream<int> watchUnreadCount(String childId) => unread!(childId);
  @override
  Future<void> setPinned(String threadId, bool pinned) async => log.add('pin:$threadId:$pinned');
  @override
  Future<void> markRead(String threadId) async => log.add('read:$threadId');
  @override
  Future<void> markAllRead(String childId) async => log.add('readAll:$childId');
  @override
  Future<void> deleteDraft(String draftId) async => log.add('deleteDraft:$draftId');
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

/// Aarav's and Ananya's demo values of one repository stream.
Future<(T, T)> _both<T>(Stream<T> Function(String childId) watch) async =>
    (await watch(DemoData.aarav.id).first, await watch(DemoData.ananya.id).first);

void main() {
  childDataSuite<AttendanceData>(
    'AttendanceBloc',
    (f) => AttendanceBloc(_Attendance(f)),
    () => _both(getIt<IAttendanceRepository>().watchAttendance),
  );
  childDataSuite<List<Homework>>(
    'HomeworkBloc',
    (f) => HomeworkBloc(_Homework(f)),
    () => _both(getIt<IHomeworkRepository>().watchHomework),
  );
  childDataSuite<List<ExamResult>>(
    'MarksBloc',
    (f) => MarksBloc(_Marks(f)),
    () => _both(getIt<IMarksRepository>().watchExams),
  );
  childDataSuite<TimetableWeek>(
    'TimetableBloc',
    (f) => TimetableBloc(_Timetable(f)),
    () async => (await getIt<ITimetableRepository>().watchWeek(DemoData.aarav.id).first, const TimetableWeek([])),
  );
  childDataSuite<FeesData>(
    'FeesBloc',
    (f) => FeesBloc(_Fees(f)),
    () async => (await getIt<IFeeRepository>().watchFees(DemoData.aarav.id).first, const FeesData([])),
  );
  childDataSuite<HomeSummary>(
    'HomeBloc',
    (f) => HomeBloc(_Home(f)),
    () => _both(getIt<IHomeRepository>().watchToday),
  );
  childDataSuite<List<LiveClass>>(
    'LiveClassesBloc',
    (f) => LiveClassesBloc(_Live(f)),
    () async => (await getIt<ILiveClassRepository>().watchLiveClasses(DemoData.aarav.id).first, const <LiveClass>[]),
  );
  childDataSuite<List<LeaveRequest>>(
    'LeaveBloc',
    (f) => LeaveBloc(_Leave(leaves: f)),
    () async => (await getIt<ILeaveRepository>().watchLeaves(DemoData.aarav.id).first, const <LeaveRequest>[]),
  );
  childDataSuite<LeaveOverview>(
    'LeaveOverviewBloc',
    (f) => LeaveOverviewBloc(_Leave(overview: f)),
    () => _both(getIt<ILeaveRepository>().watchOverview),
  );
  childDataSuite<List<Notice>>(
    'NoticesBloc',
    (f) => NoticesBloc(_Notices(f)),
    () async => (await getIt<INoticeRepository>().watchNotices(DemoData.aarav.id).first, const <Notice>[]),
  );
  childDataSuite<BehaviourReport>(
    'BehaviourBloc',
    (f) => BehaviourBloc(_Behaviour(f)),
    () => _both(getIt<IBehaviourRepository>().watchReport),
  );
  childDataSuite<MessagesOverview>(
    'MessagesBloc',
    (f) => MessagesBloc(_Messages(overview: f)),
    () => _both(getIt<IMessageRepository>().watchOverview),
  );
  childDataSuite<int>(
    'UnreadCountBloc',
    (f) => UnreadCountBloc(_Messages(unread: f)),
    () async => (1, 3),
  );
  childDataSuite<StudentProfile>(
    'StudentProfileBloc',
    (f) => StudentProfileBloc(_Student(profile: f)),
    () => _both(getIt<IStudentRepository>().watchProfile),
  );
  childDataSuite<List<Certificate>>(
    'CertificatesBloc',
    (f) => CertificatesBloc(_Student(certificates: f)),
    () async => (await getIt<IStudentRepository>().watchCertificates(DemoData.aarav.id).first, const <Certificate>[]),
  );
  childDataSuite<TeachersData>(
    'TeachersBloc',
    (f) => TeachersBloc(_Teachers(f)),
    () => _both(getIt<ITeachersRepository>().watchTeachers),
  );
  childDataSuite<PtmData>(
    'PtmBloc',
    (f) => PtmBloc(_Ptm(f)),
    () async => (
      await getIt<IPtmRepository>().watchPtm(DemoData.aarav.id).first,
      const PtmData(meetings: [], teachers: [], slots: []),
    ),
  );

  group('write events of the data BLoCs', () {
    setUp(() => setUpTestApp(signedIn: true));

    test('NoticesBloc: acknowledge goes to the repository; the stream brings the new list', () async {
      final feed = Feed<List<Notice>>();
      final repo = _Notices(feed);
      final bloc = NoticesBloc(repo)..add(const LoadChildData(_c1));
      await _tick();
      final before = await getIt<INoticeRepository>().watchNotices(DemoData.aarav.id).first;
      feed.last.add(before);
      bloc.add(const AcknowledgeNotice('ntc_7'));
      await _tick();
      expect(repo.acked, ['ntc_7']);
      feed.last.add(const []);
      await _tick();
      expect(bloc.state.data, isEmpty);
      await bloc.close();
    });

    test('LiveClassesBloc: join records the click', () async {
      final repo = _Live(Feed<List<LiveClass>>());
      final bloc = LiveClassesBloc(repo)..add(const JoinLiveClass('lc_1'));
      await _tick();
      expect(repo.joins, ['lc_1']);
      await bloc.close();
    });

    test('BehaviourBloc: acknowledge is for the loaded child, with the note; ignored before a child is loaded', () async {
      final repo = _Behaviour(Feed<BehaviourReport>());
      final bloc = BehaviourBloc(repo)..add(const AcknowledgeConduct('e1'));
      await _tick();
      expect(repo.acks, isEmpty);
      bloc
        ..add(const LoadChildData(_c1))
        ..add(const AcknowledgeConduct('e2', note: 'Will talk to him'));
      await _tick();
      expect(repo.acks, [(_c1, 'e2', 'Will talk to him')]);
      bloc.add(const AcknowledgeConduct('e3'));
      await _tick();
      expect(repo.acks.last, (_c1, 'e3', null));
      await bloc.close();
    });

    test('MessagesBloc: pin, read, read all (for the loaded child) and delete draft reach the repository', () async {
      final repo = _Messages(overview: Feed<MessagesOverview>());
      final bloc = MessagesBloc(repo)..add(const MarkAllThreadsRead());
      await _tick();
      expect(repo.log, isEmpty, reason: 'no child yet');
      bloc
        ..add(const LoadChildData(_c1))
        ..add(const PinThread('t1', pinned: true))
        ..add(const PinThread('t1', pinned: false))
        ..add(const MarkThreadRead('t2'))
        ..add(const MarkAllThreadsRead())
        ..add(const DeleteDraft('dr_1'));
      await _tick();
      expect(repo.log, unorderedEquals(['pin:t1:true', 'pin:t1:false', 'read:t2', 'readAll:$_c1', 'deleteDraft:dr_1']));
      // pins are applied one after another, so the last toggle wins
      expect(repo.log.where((e) => e.startsWith('pin:')), ['pin:t1:true', 'pin:t1:false']);
      await bloc.close();
    });
  });
}
