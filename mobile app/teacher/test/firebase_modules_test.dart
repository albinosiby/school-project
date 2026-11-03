// Module tests on the shared-Firestore backend: the real repositories and BLoCs run on FirestoreDataStore + the real
// adapters (fake network), and every test checks the remote documents against docs/DATA_CONTRACT.md and the rules.
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/attendance/bloc/leave_bloc.dart' as att;
import 'package:teacher_app/modules/attendance/bloc/leave_events.dart' as att;
import 'package:teacher_app/modules/attendance/bloc/load_status.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_events.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_states.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_events.dart';
import 'package:teacher_app/modules/attendance/bloc/marks_states.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_events.dart';
import 'package:teacher_app/modules/attendance/bloc/self_log_states.dart';
import 'package:teacher_app/modules/attendance/bloc/slips_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/slips_events.dart';
import 'package:teacher_app/modules/attendance/models/attendance_models.dart';
import 'package:teacher_app/modules/attendance/models/leave_models.dart';
import 'package:teacher_app/modules/attendance/models/marks_models.dart';
import 'package:teacher_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:teacher_app/modules/attendance/repositories/leave_repository_interface.dart' as att;
import 'package:teacher_app/modules/attendance/repositories/marks_repository_interface.dart';
import 'package:teacher_app/modules/classes/repositories/behaviour_repository_interface.dart';
import 'package:teacher_app/modules/engage/bloc/engage_notice.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_events.dart';
import 'package:teacher_app/modules/engage/bloc/exam_duties_states.dart';
import 'package:teacher_app/modules/engage/bloc/leave_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/leave_events.dart';
import 'package:teacher_app/modules/engage/bloc/leave_states.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_events.dart';
import 'package:teacher_app/modules/engage/bloc/live_classes_states.dart';
import 'package:teacher_app/modules/engage/bloc/messages_bloc.dart';
import 'package:teacher_app/modules/engage/bloc/messages_events.dart';
import 'package:teacher_app/modules/engage/bloc/messages_states.dart';
import 'package:teacher_app/modules/engage/models/live_class_models.dart';
import 'package:teacher_app/modules/engage/repositories/leave_repository_interface.dart';
import 'package:teacher_app/modules/home/bloc/substitution_bloc.dart';
import 'package:teacher_app/modules/home/bloc/substitution_events.dart';
import 'package:teacher_app/modules/home/bloc/substitution_states.dart';
import 'package:teacher_app/modules/home/models/timetable_models.dart';
import 'package:teacher_app/modules/home/repositories/timetable_repository_interface.dart';
import 'package:teacher_app/modules/lessons/repositories/certificate_repository_interface.dart';
import 'package:teacher_app/modules/school/repositories/school_repository_interface.dart';
import 'package:teacher_app/modules/tasks/models/homework_models.dart';
import 'package:teacher_app/modules/tasks/repositories/homework_repository_interface.dart';
import 'package:teacher_app/utils/services/firebase/firestore_data_store.dart';
import 'helpers/fake_gateway.dart';
import 'helpers/firebase_app.dart';

/// Waits until [bloc]'s state satisfies [ok] (or fails after a while).
Future<S> until<S>(Stream<S> stream, S current, bool Function(S) ok) async {
  if (ok(current)) return current;
  return stream.firstWhere(ok).timeout(const Duration(seconds: 5));
}

void main() {
  late FirestoreDataStore store;
  late FakeGateway gw;

  Future<void> boot([List<String> warm = const []]) async {
    final app = await setUpFirebaseApp(warm: warm);
    store = app.store;
    gw = app.gw;
  }

  tearDown(() => store.stop());

  group('attendance marking', () {
    test('MarkAttendanceBloc saves ops_attendance {date}_{classId}_{period} with only non-present marks', () async {
      await boot(['att_records', 'att_staff', 'att_notices', 'att_slips', 'att_medical']);
      final bloc = getIt<MarkAttendanceBloc>()..add(const MarkAttendanceLoadRequested(classId: 'cls_10B', period: 3));
      final s = await until<MarkAttendanceState>(bloc.stream, bloc.state, (s) => s.status == LoadStatus.loaded && s.roster.length == 2);
      expect(s.marks.values.toSet(), {AttCode.present});
      bloc.add(const MarkAttendanceCodeSet('stu_102', AttCode.absent));
      bloc.add(const MarkAttendanceSaved(submit: true));
      await until<MarkAttendanceState>(bloc.stream, bloc.state, (s) => s.submitted);
      final w = writesTo(gw, 'ops_attendance').last;
      expect(w.id, '${todayKey}_cls_10B_3');
      expect(w.data['marks'], {'stu_102': 'A'});
      expect((w.data['total'], w.data['grade'], w.data['section'], w.data['period'], w.data['submitted']), (2, '10', 'B', 3, true));
      expect((w.data['teacherId'], w.data['updatedBy']), ('stf_025', 'uid_anita'));
      expect(DateTime.tryParse('${w.data['updatedAt']}'), isNotNull);
      // a second save of the same sheet updates the same document
      bloc.add(const MarkAttendanceCodeSet('stu_102', AttCode.late));
      bloc.add(const MarkAttendanceSaved(submit: true));
      await settle();
      expect(writesTo(gw, 'ops_attendance').map((w) => w.id).toSet(), {'${todayKey}_cls_10B_3'});
      expect(writesTo(gw, 'ops_attendance').last.data['marks'], {'stu_102': 'L'});
      await bloc.close();
    });
  });

  group('homework', () {
    test('create writes ops_homework with the denormalized admin fields and one pending entry per student', () async {
      await boot(['tk_homework', 'students']);
      final repo = getIt<IHomeworkRepository>();
      final hw = await repo.create(Homework(id: '', classId: 'cls_10B', title: 'Quadratics set 5', subject: 'Mathematics', due: isoDay(4), maxMarks: 20, createdAt: '${todayKey}T09:00:00'));
      final w = writesTo(gw, 'ops_homework').last;
      expect(w.id, hw.id);
      expect((w.data['teacherId'], w.data['teacher'], w.data['grade'], w.data['section'], w.data['assigned']), ('stf_025', 'Mrs. Anita Sharma', '10', 'B', todayKey));
      expect((w.data['submitted'], w.data['total']), (0, 2));
      expect((w.data['submissions'] as Map).keys, unorderedEquals(['stu_101', 'stu_102']));
    });

    test('grading updates submissions and the submitted count; delete is a soft delete', () async {
      await boot(['tk_homework', 'students']);
      final repo = getIt<IHomeworkRepository>();
      final admin = (await repo.get('hw_admin'))!;
      expect(admin.status, 'open'); // admin-created homework (no status) shows as open
      expect(admin.submissions.keys, unorderedEquals(['stu_101', 'stu_102']));
      await repo.update(admin.copyWith(submissions: {
        ...admin.submissions,
        'stu_101': const Submission(status: SubmissionStatus.graded, marks: 18, feedback: 'Well done', gradedAt: '2026-11-03T10:00:00'),
      }));
      final w = writesTo(gw, 'ops_homework').last;
      expect(w.id, 'hw_admin');
      expect(w.data['submitted'], 1);
      expect((w.data['submissions'] as Map)['stu_101'], containsPair('marks', 18));
      await repo.delete('hw_admin');
      final del = writesTo(gw, 'ops_homework').last;
      expect(del.delete, isFalse, reason: 'teachers may not hard-delete shared records');
      expect(del.data['deleted'], true);
      expect(await repo.get('hw_admin'), isNull);
    });
  });

  group('marks entry', () {
    test('marks of an open paper go to exm_marks; locked and published papers are read-only', () async {
      await boot(['att_exams', 'att_marks', 'att_records']);
      final bloc = getIt<MarksBloc>()..add(const MarksLoadRequested(examId: 'pap_open@cls_10B'));
      final s = await until<MarksState>(bloc.stream, bloc.state, (s) => s.status == LoadStatus.loaded && s.exams.length == 3);
      final byId = {for (final e in s.exams) e.id: e};
      expect(byId['pap_open@cls_10B']!.status, 'Draft');
      expect(byId['pap_open@cls_10B']!.max, 80);
      expect(byId['pap_locked@cls_10B']!.lockedByAdmin, isTrue);
      expect(byId['pap_pub@cls_10B']!.lockedByAdmin, isTrue);

      bloc.add(const MarkSaved(StudentMark(examId: 'pap_open@cls_10B', studentId: 'stu_101', marks: 72, tag: 'Consistent')));
      await settle();
      final w = writesTo(gw, 'exm_marks').single;
      expect(w.id, 'pap_open__cand_stu_101');
      expect((w.data['paperId'], w.data['candId'], w.data['studentId'], w.data['theory'], w.data['teacherId']), ('pap_open', 'cand_stu_101', 'stu_101', 72, 'stf_025'));
      expect(w.data.keys, isNot(contains('internal')));
      expect(w.data.keys, isNot(contains('verified')));

      final before = gw.writes.length;
      bloc.add(const MarkSaved(StudentMark(examId: 'pap_locked@cls_10B', studentId: 'stu_101', marks: 50)));
      bloc.add(const MarksExamSubmitted('pap_locked@cls_10B'));
      await settle();
      expect(gw.writes.length, before, reason: 'locked paper: nothing is written');
      // even straight through the repository the adapter refuses a locked paper's marks
      await getIt<IMarksRepository>().saveMark(const StudentMark(examId: 'pap_pub@cls_10B', studentId: 'stu_101', marks: 50));
      expect(writesTo(gw, 'exm_marks', before), isEmpty);
      await bloc.close();
    });
  });

  group('leave', () {
    test('apply leave creates a Pending staff_leaves request with from/to and the policy quota', () async {
      await boot(['att_leaves', 'att_quota', 'att_periods', 'att_faculty']);
      final bloc = getIt<att.LeaveBloc>()..add(const att.LeaveLoadRequested());
      await settle();
      expect(bloc.state.quota.map((q) => q.short), ['Casual Leave', 'Medical Leave', 'Earned Leave']);
      expect(bloc.state.quota.first.used, 2); // the approved 2-day casual leave
      expect(bloc.state.periods.map((p) => p.id), containsAll(['per_10B_${todayName}_3', 'per_8C_Fri_2']));
      expect(bloc.state.faculty.map((f) => f.id), unorderedEquals(['stf_008']), reason: 'only teaching staff, not me or the clerk');
      bloc.add(att.LeaveApplied(LeaveApplication(type: 'Medical Leave', start: isoDay(12), end: isoDay(13), days: 2, reason: 'Minor surgery recovery', createdAt: '${todayKey}T08:00:00')));
      await settle();
      final w = writesTo(gw, 'staff_leaves').last;
      expect((w.data['staffId'], w.data['teacherId'], w.data['status'], w.data['type']), ('stf_025', 'stf_025', 'Pending', 'Medical Leave'));
      expect((w.data['from'], w.data['to'], w.data['days']), (isoDay(12), isoDay(13), 2));
      expect(writesTo(gw, 'approvals'), isEmpty, reason: 'the admin web creates the approvals mirror');
      await bloc.close();
    });

    test('withdrawing a pending leave deletes staff_leaves and keeps a private Cancelled copy; decided leaves stay', () async {
      await boot(['lm_my', 'lm_balance', 'lm_student']);
      final bloc = getIt<LeaveBloc>()..add(const LeaveLoadRequested());
      await until<LeaveState>(bloc.stream, bloc.state, (s) => s.status == EngageStatus.loaded && s.myLeaves.length == 2);
      final before = gw.writes.length;
      bloc.add(const MyLeaveCancelled('slv_approved'));
      final refused = await until<LeaveState>(bloc.stream, bloc.state, (s) => s.notice?.message.startsWith('Only a pending leave') == true);
      expect(refused.myLeaves.firstWhere((l) => l.id == 'slv_approved').status, 'Approved');
      expect(gw.writes.length, before);

      bloc.add(const MyLeaveCancelled('slv_pending'));
      await until<LeaveState>(bloc.stream, bloc.state, (s) => s.myLeaves.any((l) => l.id == 'slv_pending' && l.status == 'Cancelled'));
      final ws = gw.writes.skip(before).toList();
      expect(ws.where((w) => w.collection == 'staff_leaves').single.delete, isTrue);
      final copy = ws.firstWhere((w) => w.collection == 'lm_withdrawn');
      expect((copy.id, copy.data['status'], copy.data['teacherId']), ('slv_pending', 'Cancelled', 'stf_025'));
      await bloc.close();
    });

    test('deciding a parent\'s student leave writes only the decision fields', () async {
      await boot(['lm_my', 'lm_balance', 'lm_student']);
      final bloc = getIt<LeaveBloc>()..add(const LeaveLoadRequested());
      await until<LeaveState>(bloc.stream, bloc.state, (s) => s.studentLeaves.length == 2);
      bloc.add(const StudentLeaveDecided('sl_1', approve: true));
      await until<LeaveState>(bloc.stream, bloc.state, (s) => s.studentLeaves.any((l) => l.id == 'sl_1' && !l.pending));
      final w = writesTo(gw, 'student_leaves').last;
      expect(w.id, 'sl_1');
      expect(w.data.keys.toSet(), {'status', 'decisionNote', 'decidedBy', 'decidedAt', 'updatedAt', 'updatedBy'});
      expect((w.data['status'], w.data['decidedBy']), ('Approved', 'stf_025'));
      final row = (await getIt<ILeaveRepository>().getStudentLeaves()).firstWhere((l) => l.id == 'sl_1');
      expect(row.processedBy, 'by Mrs. Anita Sharma');
      expect(row.by, 'Mr. Sharma (Father)');
      await bloc.close();
    });

    test('slips: Clarify keeps the request Pending (note to the parent), medical slips decide the shared request', () async {
      await boot(['att_slips', 'att_medical', 'att_records']);
      final bloc = getIt<SlipsBloc>()..add(const SlipsLoadRequested());
      await settle();
      expect(bloc.state.leaveSlips.map((s) => s.id), containsAll(['sl_1', 'sl_med']));
      expect(bloc.state.leaveSlips.firstWhere((s) => s.id == 'sl_1').parent, 'Mr. Sharma (Father)');
      expect(bloc.state.medical.single.id, 'sl_med');
      expect(bloc.state.medical.single.file, 'Fever_Certificate.pdf');
      bloc.add(const LeaveSlipStatusChanged('sl_1', 'Clarify', note: 'Please attach the invitation'));
      await settle();
      final w = writesTo(gw, 'student_leaves').last;
      expect((w.data['status'], w.data['decisionNote']), ('Pending', 'Please attach the invitation'));
      expect(writesTo(gw, 'att_slip_state').single.data['status'], 'Clarify');
      expect(bloc.state.leaveSlips.firstWhere((s) => s.id == 'sl_1').status, 'Clarify');
      bloc.add(const MedicalSlipDecided('sl_med', approved: false, reason: 'Certificate unreadable'));
      await settle();
      final m = writesTo(gw, 'student_leaves').last;
      expect((m.id, m.data['status'], m.data['decisionNote'], m.data['decidedBy']), ('sl_med', 'Rejected', 'Certificate unreadable', 'stf_025'));
      await bloc.close();
    });
  });

  group('substitutions', () {
    test('a checklist tick stays private; accept / decline change only the shared status', () async {
      await boot(['tt_subs']);
      final repo = getIt<ITimetableRepository>();
      expect((await repo.getSubstitution('sub_1'))!.status, SubStatus.pending);
      final bloc = getIt<SubstitutionBloc>()..add(const SubstitutionLoadRequested('sub_1'));
      await until<SubstitutionState>(bloc.stream, bloc.state, (s) => s.sub != null);
      final before = gw.writes.length;
      await repo.setSubstitutionStatus('sub_1', SubStatus.pending); // e.g. saving the checklist of a pending duty
      expect(writesTo(gw, 'ops_substitutions', before), isEmpty);
      expect(writesTo(gw, 'tt_subs', before).single.data['teacherId'], 'stf_025');
      bloc.add(const SubstitutionStatusChanged(SubStatus.accepted));
      await settle();
      final a = writesTo(gw, 'ops_substitutions').single;
      expect(a.data.keys.toSet(), {'status', 'updatedAt', 'updatedBy'});
      expect(a.data['status'], 'Accepted');
      bloc.add(const SubstitutionStatusChanged(SubStatus.declined));
      await settle();
      expect(writesTo(gw, 'ops_substitutions').last.data['status'], 'Declined');
      expect((await repo.getSubstitution('sub_1'))!.status, SubStatus.declined);
      await bloc.close();
    });
  });

  group('live classes', () {
    test('scheduling writes live_classes (Google Meet link, date, time, mins); cancelling is a soft delete', () async {
      await boot(['lv_sessions']);
      final bloc = getIt<LiveClassesBloc>()..add(const LiveClassesLoadRequested());
      await until<LiveClassesState>(bloc.stream, bloc.state, (s) => s.status == EngageStatus.loaded);
      bloc.add(LiveSessionSaved(LiveSession(title: 'Trigonometry revision', classId: 'cls_10B', subject: 'Mathematics', date: isoDay(2), time: '17:00', mins: 60, medium: 'Google Meet', link: 'https://meet.google.com/xyz-abcd-efg', total: 2)));
      await until<LiveClassesState>(bloc.stream, bloc.state, (s) => s.notice?.message.startsWith('Class scheduled') == true);
      final w = writesTo(gw, 'live_classes').last;
      expect((w.data['classId'], w.data['teacherId'], w.data['date'], w.data['time'], w.data['mins']), ('cls_10B', 'stf_025', isoDay(2), '17:00', 60));
      expect((w.data['medium'], w.data['link'], w.data['status']), ('Google Meet', 'https://meet.google.com/xyz-abcd-efg', 'upcoming'));
      expect(w.data.containsKey('joined'), isFalse, reason: 'join counts come from live_classes/{id}/joins');
      expect(DateTime.tryParse('${w.data['createdAt']}'), isNotNull);
      bloc.add(const LiveSessionDeleted('lc_1', message: 'Class cancelled'));
      await settle();
      final d = writesTo(gw, 'live_classes').last;
      expect((d.id, d.delete, d.data['deleted'], d.data['status']), ('lc_1', false, true, 'cancelled'));
      expect(bloc.state.byId('lc_1'), isNull);
      await bloc.close();
    });
  });

  group('messages', () {
    test('opening a guardian thread resets only unreadTeacher; a reply is one msg_messages doc', () async {
      await boot(['ms_messages', 'ms_contacts', 'ms_drafts']);
      final bloc = getIt<MessagesBloc>()..add(const MessagesLoadRequested());
      final s = await until<MessagesState>(bloc.stream, bloc.state, (s) => s.status == EngageStatus.loaded && s.threads.isNotEmpty);
      const tid = 'thr_stu_101_stf_025';
      expect(s.thread(tid)!.unread, 1);
      bloc.add(const ThreadOpened(tid));
      await settle();
      final read = writesTo(gw, 'msg_threads').single;
      expect(read.id, tid);
      expect(read.data, {'unreadTeacher': 0});
      bloc.add(const ReplySent(tid, 'Yes, on Friday.'));
      await settle();
      final m = writesTo(gw, 'msg_messages').single;
      expect((m.data['threadId'], m.data['from'], m.data['uid'], m.data['teacherId'], m.data['text']), (tid, 'teacher', 'uid_anita', 'stf_025', 'Yes, on Friday.'));
      expect(m.data['parentUids'], ['par_1']);
      expect(m.data.containsKey('counted'), isFalse);
      // a guardian without a parent app login cannot be messaged: nothing is written
      final before = gw.writes.length;
      bloc.add(const MessageSent(to: ['g_stu_102'], text: 'Hello'));
      await settle();
      expect(writesTo(gw, 'msg_threads', before), isEmpty);
      expect(writesTo(gw, 'msg_messages', before), isEmpty);
      await bloc.close();
    });
  });

  group('check-in / out and regularization', () {
    test('punch in/out writes staff_attendance/{date}_{staffId}; a regularization starts Pending', () async {
      await boot(['att_staff', 'att_regs', 'att_quota']);
      final bloc = getIt<SelfLogBloc>()..add(const SelfLogLoadRequested());
      await until<SelfLogState>(bloc.stream, bloc.state, (s) => s.status == LoadStatus.loaded);
      bloc.add(const SelfLogPunchedIn('08:40'));
      await until<SelfLogState>(bloc.stream, bloc.state, (s) => s.today != null);
      final pin = writesTo(gw, 'staff_attendance').single;
      expect(pin.id, '${todayKey}_stf_025');
      expect((pin.data['staffId'], pin.data['teacherId'], pin.data['date'], pin.data['in'], pin.data['status'], pin.data['source']), ('stf_025', 'stf_025', todayKey, '08:40', 'Late', 'app'));
      bloc.add(const SelfLogPunchedOut('16:05'));
      await settle();
      final pout = writesTo(gw, 'staff_attendance').last;
      expect(pout.id, '${todayKey}_stf_025');
      expect(pout.data['out'], '16:05');
      expect(pout.data.containsKey('in'), isFalse, reason: 'an admin correction of the check-in is kept');
      bloc.add(SelfLogRegularizationSubmitted(Regularization(date: isoDay(-1), type: 'Check-out', time: '16:30', reason: 'Forgot to punch out', at: '${todayKey}T09:00:00')));
      await settle();
      final r = writesTo(gw, 'staff_regularizations').single;
      expect((r.data['staffId'], r.data['teacherId'], r.data['status'], r.data['type'], r.data['time'], r.data['date']), ('stf_025', 'stf_025', 'Pending', 'Check-out', '16:30', isoDay(-1)));
      expect(getIt<IAttendanceRepository>(), isNotNull);
      await bloc.close();
    });
  });

  group('exam duties', () {
    test('duties come from exm_duties with the partner; swap requests and checklists stay in ed_duty_state', () async {
      await boot(['ed_duties', 'ed_candidates']);
      final bloc = getIt<ExamDutiesBloc>()..add(const ExamDutiesLoadRequested());
      final s = await until<ExamDutiesState>(bloc.stream, bloc.state, (s) => s.status == EngageStatus.loaded && s.duties.isNotEmpty);
      final d = s.duties.single;
      expect((d.id, d.partner, d.hall, d.candidates), ('dut_1', 'Dr. Myra Sharma', 'Hall A', 2));
      bloc.add(const SwapRequested('dut_1', withWhom: 'Mr. Rohan Verma', reason: 'Clash with a parent meeting'));
      await settle();
      bloc.add(const ChecklistItemToggled('dut_1', 0, checked: true));
      await settle();
      final ws = writesTo(gw, 'ed_duty_state');
      expect(ws.map((w) => w.id).toSet(), {'dut_1_stf_025'});
      expect(ws.last.data['checked'], [0]);
      expect(ws.any((w) => w.data['swapWith'] == 'Mr. Rohan Verma'), isTrue);
      expect(writesTo(gw, 'exm_duties'), isEmpty, reason: 'duties are the admin\'s');
      await bloc.close();
    });
  });

  group('profile and catalogues', () {
    test('profile edits go to the private hm_me overlay; badges and templates start from the built-in catalogue', () async {
      await boot(['me', 'cl_badges', 'cr_templates']);
      final school = getIt<ISchoolRepository>();
      final me = await school.getTeacher();
      expect(me.name, 'Mrs. Anita Sharma');
      await school.updateTeacher(me.copyWith(phone: '98100 11111'));
      final w = writesTo(gw, 'hm_me').single;
      expect((w.id, w.data['phone'], w.data['teacherId']), ('stf_025', '98100 11111', 'stf_025'));
      expect((await school.getTeacher()).phone, '98100 11111');
      expect(await getIt<IBehaviourRepository>().getBadges(), isNotEmpty);
      expect(await getIt<ICertificateRepository>().getTemplates(), isNotEmpty);
    });
  });

  test('every local collection the repositories touched was written to a collection the teacher rules allow', () async {
    await boot(['att_records', 'tk_homework', 'lm_my', 'att_leaves', 'lv_sessions', 'ms_messages', 'att_staff', 'tt_subs']);
    expect(getIt<att.ILeaveRepository>(), isNotNull);
    // a representative mix of writes through the store
    store.add('tk_tasks', {'title': 'Mark papers'});
    store.add('cl_resources', {'title': 'Worksheet'});
    store.setDoc('settings', {'dnd': true});
    store.setDoc('hm_profile', {'bloodGroup': 'O+'});
    await settle();
    for (final w in gw.writes) {
      expect(teacherMayWrite(w.collection), isTrue, reason: '${w.collection}/${w.id}');
    }
  });
}

/// Remote collections the teacher role may create/update per firestore.rules (shared records + private prefixes).
bool teacherMayWrite(String c) =>
    const {'ops_attendance', 'ops_homework', 'exm_marks', 'live_classes', 'staff_leaves', 'staff_attendance', 'staff_regularizations', 'approvals', 'ops_substitutions', 'student_leaves', 'msg_threads', 'msg_messages'}.contains(c) ||
    RegExp(r'^(tt|tk|cl|ls|ts|hm|ms|pm|ed|cr|att|lm)_.*').hasMatch(c);
