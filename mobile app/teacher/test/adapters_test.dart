// Adapter unit tests (pure, no Firebase): read mapping, write mapping, id schemes and stamp fields of every
// StoreAdapter, plus a rules-conformance sweep over all of them (see website/firestore.rules, teacher section).
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/utils/services/firebase/store_adapters.dart';
import 'helpers/firebase_app.dart';

final _now = DateTime(2026, 11, 3, 9, 30); // a Tuesday
final ctx = AdapterContext(schoolId: 's1', staffId: 'stf_025', authUid: 'uid1', clock: () => _now);

/// Collections the teacher may read with any query (firestore.rules, "teacher: read the master + shared collections").
const _openRead = {
  'school', 'staff', 'classes', 'assignments', 'students', 'ops_periods', 'ops_substitutions', 'exm_cycles', 'exm_papers', 'exm_candidates',
  'com_notices', 'calendar_events', 'ops_attendance', 'ops_homework', 'exm_marks', 'live_classes', 'student_leaves', 'exm_duties', 'set_leave_policy',
};
final _private = RegExp(r'^(tt|tk|cl|ls|ts|hm|ms|pm|ed|cr|att|lm)_.*');

/// Would the teacher rules allow this listener? Owner-scoped collections need the owner filter in the query itself.
bool queryAllowed(RemoteQuery q, String staffId) {
  if (_openRead.contains(q.collection)) return true;
  if (const {'staff_leaves', 'staff_attendance', 'staff_regularizations'}.contains(q.collection)) return q.eq['staffId'] == staffId;
  if (_private.hasMatch(q.collection) || const {'msg_threads', 'msg_messages', 'ptm_slots', 'ptm_bookings'}.contains(q.collection)) return q.eq['teacherId'] == staffId;
  return false;
}

/// Would the teacher rules allow this write (collection + owner fields; per-field checks are in the adapter tests)?
bool writeAllowed(RemoteWrite w, String staffId) {
  final d = w.data;
  switch (w.collection) {
    case 'ops_attendance' || 'ops_homework' || 'exm_marks' || 'live_classes':
      return !w.delete && d['teacherId'] == staffId;
    case 'staff_leaves':
      return w.delete || (d['staffId'] == staffId && d['status'] == 'Pending');
    case 'staff_attendance':
      return !w.delete && (d['staffId'] == null || d['staffId'] == staffId) && w.id.endsWith('_$staffId');
    case 'staff_regularizations':
      return !w.delete && d['staffId'] == staffId && d['status'] == 'Pending';
    case 'ops_substitutions':
      return !w.delete && d.keys.toSet().difference({'status', 'updatedAt', 'updatedBy'}).isEmpty && const {'Accepted', 'Declined'}.contains(d['status']);
    case 'student_leaves':
      return !w.delete && d.keys.toSet().difference({'status', 'decisionNote', 'decidedBy', 'decidedAt', 'updatedAt', 'updatedBy'}).isEmpty &&
          const {'Pending', 'Approved', 'Rejected'}.contains(d['status']);
    case 'msg_threads':
      return !w.delete && (d['teacherId'] == staffId || (d.keys.length == 1 && d['unreadTeacher'] == 0));
    case 'msg_messages':
      return !w.delete && d['teacherId'] == staffId && d['from'] == 'teacher' && !d.containsKey('counted');
    default:
      return _private.hasMatch(w.collection) && (w.delete || d['teacherId'] == staffId);
  }
}

void main() {
  group('every adapter against the teacher rules', () {
    final fixture = schoolFixture();
    final adapters = firebaseAdapters();

    test('one adapter per local collection, and every remote name it writes is allowed', () {
      final locals = [for (final a in adapters) a.local];
      // the catalogues replace the plain private adapters of the same name
      expect(locals.where((l) => l == 'cl_badges').length, 1, reason: 'cl_badges is a CatalogueAdapter only');
      expect(locals.toSet().length, locals.length);
    });

    for (final a in firebaseAdapters()) {
      test('${a.local}: listeners are allowed by the rules', () {
        for (final q in a.queries(fbCtx, fixture)) {
          expect(queryAllowed(q, fbCtx.staffId), isTrue, reason: '${a.local} -> ${q.key}');
        }
      });
      test('${a.local}: builds rows with string ids; a write of its first row is allowed and stamped', () {
        final rows = a.build(fbCtx, fixture);
        for (final r in rows) {
          expect(r['id'], isA<String>(), reason: '${a.local} row $r');
        }
        if (a.readOnly) {
          expect(a.write(fbCtx, fixture, rows.isEmpty ? {'id': 'x'} : rows.first), isEmpty, reason: '${a.local} is read-only');
          return;
        }
        final row = rows.isEmpty ? <String, dynamic>{'id': '${a.local}_new', 'title': 'x'} : rows.first;
        for (final w in a.write(fbCtx, fixture, row)) {
          expect(writeAllowed(w, fbCtx.staffId), isTrue, reason: '${a.local} -> ${w.collection}/${w.id} ${w.data}');
          if (!w.delete && w.data.length > 1) {
            expect(w.data['updatedBy'], fbCtx.authUid, reason: '${a.local} -> ${w.collection} updatedBy');
            expect(DateTime.tryParse('${w.data['updatedAt'] ?? ''}'), isNotNull, reason: '${a.local} -> ${w.collection} updatedAt');
          }
        }
      });
    }
  });

  group('me / private', () {
    test('profile edits: hm_me/{staffId}, only name/email/phone, stamped', () {
      final w = const MeAdapter().write(ctx, {}, {'id': 'me', 'name': 'A', 'email': 'e', 'phone': 'p', 'empId': 'hack'}).single;
      expect((w.collection, w.id), ('hm_me', 'stf_025'));
      expect(w.data.keys.toSet(), {'name', 'email', 'phone', 'teacherId', 'updatedAt', 'updatedBy'});
      expect(w.data['updatedAt'], _now.toIso8601String());
      final me = const MeAdapter().build(ctx, {
        'staff': [{'id': 'stf_025', 'name': 'Mrs. Anita Sharma', 'designation': 'Senior Faculty', 'phone': '1'}],
        'hm_me': [{'id': 'stf_025', 'teacherId': 'stf_025', 'phone': '2'}],
      }).single;
      expect((me['id'], me['phone'], me['short'], me['title']), ('me', '2', 'Anita', 'Senior Faculty'));
      expect(const MeAdapter().build(ctx, {}), isEmpty, reason: 'no staff doc yet');
    });

    test('notifications and settings use the hm_ names; single docs get the staff id', () {
      const n = PrivateAdapter('notifications', 'hm_notifications'), st = PrivateAdapter('settings', 'hm_settings');
      expect(n.queries(ctx, {}).single.key, RemoteQuery('hm_notifications', eq: {'teacherId': 'stf_025'}).key);
      // a row written by the push function (no ord, source push) shows up
      final rows = n.build(ctx, {'hm_notifications': [{'id': 'n1', 'teacherId': 'stf_025', 'title': 'Leave approved', 'read': false, 'route': '/leave-management', 'source': 'push'}, {'id': 'n2', 'teacherId': 'stf_999'}]});
      expect(rows.single['title'], 'Leave approved');
      expect(rows.single.containsKey('teacherId'), isFalse);
      final w = st.write(ctx, {}, {'id': 'settings', 'dnd': true, 'dndFrom': '21:00', 'dndTo': '07:00', 'parentMute': true, 'classUpdates': false, 'parentMessages': true}).single;
      expect((w.collection, w.id), ('hm_settings', 'settings_stf_025'));
      expect(w.data.keys, containsAll(['dnd', 'dndFrom', 'dndTo', 'parentMute', 'classUpdates', 'parentMessages', 'teacherId']));
      expect(st.build(ctx, {'hm_settings': [{...w.data, 'id': w.id}]}).single['id'], 'settings');
      expect(st.delete(ctx, {}, {'id': 'settings'}).single.id, 'settings_stf_025');
    });

    test('catalogues: built-in rows plus the teacher\'s own, own rows win; deleting a built-in writes nothing', () {
      const cat = CatalogueAdapter('cl_badges', [{'id': 'b1', 'name': 'Leader'}, {'id': 'b2', 'name': 'Helper'}]);
      final rows = cat.build(ctx, {'cl_badges': [{'id': 'b2', 'teacherId': 'stf_025', 'name': 'Helping Hand'}, {'id': 'b9', 'teacherId': 'stf_025', 'name': 'Custom'}]});
      expect(rows.map((r) => r['name']), ['Leader', 'Helping Hand', 'Custom']);
      expect(cat.delete(ctx, {}, {'id': 'b1'}), isEmpty);
      expect(cat.delete(ctx, {'cl_badges': [{'id': 'b9', 'teacherId': 'stf_025'}]}, {'id': 'b9'}).single.delete, isTrue);
      expect(cat.write(ctx, {}, {'id': 'b3', 'name': 'New'}).single.data['teacherId'], 'stf_025');
      expect(cat.build(ctx, {}).length, 2);
    });

    test('read-only master data passes fields through and never writes', () {
      const school = ReadOnlyAdapter('school', 'school');
      expect(school.build(ctx, {'school': [{'id': 'school', 'name': 'G'}]}).single['name'], 'G');
      expect(school.write(ctx, {}, {'id': 'school'}), isEmpty);
      expect(school.readOnly, isTrue);
    });
  });

  group('timetable, substitutions', () {
    final remote = {
      'ops_periods': [
        {'id': 'per_10B_Tue_3', 'classId': 'cls_10B', 'day': 'Tue', 'period': 3, 'subject': 'Mathematics', 'teacherId': 'stf_025', 'room': 'Room 204'},
        {'id': 'per_10B_Tue_1', 'classId': 'cls_10B', 'day': 'Tue', 'period': 1, 'subject': 'Mathematics', 'teacherId': 'stf_025', 'room': 'Room 204'},
        {'id': 'per_8C_Mon_2', 'classId': 'cls_8C', 'day': 'Mon', 'period': 2, 'subject': 'Physics', 'teacherId': 'stf_025', 'room': 'Lab 1'},
        {'id': 'per_9A_Tue_3', 'classId': 'cls_9A', 'day': 'Tue', 'period': 3, 'subject': 'English', 'teacherId': 'stf_008'},
      ],
      'ops_substitutions': [
        {'id': 'sub_a', 'date': '2026-11-03', 'day': 'Tue', 'period': 5, 'classId': 'cls_8C', 'subject': 'Physics', 'substituteTeacherId': 'stf_025', 'status': 'Accepted'},
        {'id': 'sub_b', 'date': '2026-11-03', 'day': 'Tue', 'period': 6, 'classId': 'cls_8C', 'subject': 'Physics', 'substituteTeacherId': 'stf_025', 'status': 'Assigned'},
      ],
      'staff': [
        {'id': 'stf_025', 'name': 'Me'},
        {'id': 'stf_008', 'name': 'Mr. Rohan Verma', 'department': 'English', 'role': 'TGT'},
        {'id': 'stf_010', 'name': 'Ms. Free All', 'department': 'Maths', 'designation': 'PGT'},
        {'id': 'stf_090', 'name': 'Clerk', 'department': 'Accounts'},
        {'id': 'stf_011', 'name': 'Gone', 'status': 'Inactive'},
      ],
      'assignments': [
        {'id': 'a1', 'teacherId': 'stf_010', 'classId': 'cls_9A', 'subject': 'Maths'},
        {'id': 'a2', 'teacherId': 'stf_011', 'classId': 'cls_9A', 'subject': 'Maths'},
      ],
    };

    test('att_sched = today\'s own periods + accepted substitutions, by period', () {
      final rows = const TodayScheduleAdapter().build(ctx, remote);
      expect(rows.map((r) => (r['id'], r['classId'], r['period'])), [('per_10B_Tue_1', 'cls_10B', 1), ('per_10B_Tue_3', 'cls_10B', 3), ('sub_sub_a', 'cls_8C', 5)]);
      expect(const TodayScheduleAdapter().readOnly, isTrue);
      final sunday = AdapterContext(schoolId: 's1', staffId: 'stf_025', authUid: 'uid1', clock: () => DateTime(2026, 11, 8));
      expect(const TodayScheduleAdapter().build(sunday, remote), isEmpty);
    });

    test('att_periods = the teacher\'s week, Mon first, with period times and class labels', () {
      final rows = const HandoverPeriodsAdapter().build(ctx, remote);
      expect(rows.map((r) => r['id']), ['per_8C_Mon_2', 'per_10B_Tue_1', 'per_10B_Tue_3']);
      expect(rows.first['label'], 'Mon • Period 2');
      expect(rows.first['time'], '09:15 AM – 10:00 AM');
      expect(rows.first['cls'], 'Grade 8–C • Physics');
      expect(rows.first['room'], 'Lab 1');
    });

    test('att_faculty = other active teaching staff, most free first', () {
      final rows = const FacultyAdapter().build(ctx, remote);
      expect(rows.map((r) => r['id']), ['stf_010', 'stf_008']);
      expect(rows.first['free'], 'Free 3 of 3 periods');
      expect(rows.last['free'], 'Free 2 of 3 periods'); // busy Tue P3
      expect(rows.first['role'], 'PGT • Maths');
    });

    test('substitution status: only a change to Accepted/Declined is sent; tasks stay private', () {
      final subs = {
        'ops_substitutions': [{'id': 'sub_b', 'substituteTeacherId': 'stf_025', 'status': 'Assigned', 'classId': 'cls_8C', 'day': 'Tue', 'period': 6, 'date': '2026-11-03'}],
      };
      const a = SubstitutionsAdapter();
      final tick = a.write(ctx, subs, {'id': 'sub_b', 'status': 'pending', 'tasks': [{'t': 'Roll', 'done': true}]});
      expect(tick.map((w) => w.collection), ['tt_subs']);
      expect(tick.single.data['teacherId'], 'stf_025');
      final acc = a.write(ctx, subs, {'id': 'sub_b', 'status': 'accepted'});
      expect(acc.first.collection, 'ops_substitutions');
      expect(acc.first.data, {'status': 'Accepted', 'updatedAt': _now.toIso8601String(), 'updatedBy': 'uid1'});
      final again = a.write(ctx, {'ops_substitutions': [{'id': 'sub_b', 'status': 'Accepted'}]}, {'id': 'sub_b', 'status': 'accepted'});
      expect(again.map((w) => w.collection), ['tt_subs'], reason: 'unchanged status is not re-sent');
    });

    test('private timetable extras: only remedial/prep rows are written, core periods are read-only', () {
      const a = PeriodsAdapter();
      expect(a.write(ctx, remote, {'id': 'per_10B_Tue_3', 'kind': 'core'}), isEmpty);
      final w = a.write(ctx, remote, {'id': 'x1', 'kind': 'remedial', 'day': 2, 'slot': 'P8'}).single;
      expect((w.collection, w.data['teacherId']), ('tt_periods', 'stf_025'));
      expect(a.delete(ctx, remote, {'id': 'per_10B_Tue_3'}), isEmpty);
    });
  });

  group('shared records', () {
    test('homework: soft delete, deleted rows hidden, status words', () {
      const a = HomeworkAdapter();
      final del = a.delete(ctx, {}, {'id': 'hw_1'}).single;
      expect((del.collection, del.id, del.delete, del.data['deleted'], del.data['teacherId']), ('ops_homework', 'hw_1', false, true, 'stf_025'));
      final rows = a.build(ctx, {'ops_homework': [
        {'id': 'hw_1', 'teacherId': 'stf_025', 'classId': 'cls_10B', 'deleted': true},
        {'id': 'hw_2', 'teacherId': 'stf_025', 'classId': 'cls_10B', 'status': 'draft', 'submissions': {'stu_1': {'status': 'pending'}}},
      ]});
      expect(rows.map((r) => (r['id'], r['status'])), [('hw_2', 'draft')]);
      expect(HomeworkAdapter.localStatus('Published'), 'open');
    });

    test('live classes: soft delete with status cancelled; deleted sessions hidden; joined not sent', () {
      const a = LiveClassesAdapter();
      final del = a.delete(ctx, {}, {'id': 'lc_1'}).single;
      expect((del.delete, del.data['deleted'], del.data['status'], del.data['updatedBy']), (false, true, 'cancelled', 'uid1'));
      expect(a.build(ctx, {'live_classes': [{'id': 'lc_1', 'teacherId': 'stf_025', 'classId': 'cls_10B', 'deleted': true}]}), isEmpty);
      final w = a.write(ctx, {}, {'id': 'lc_2', 'classId': 'c_10b', 'title': 'T', 'date': '2026-11-04', 'time': '16:00', 'mins': 45, 'medium': 'Google Meet', 'link': 'https://meet.google.com/abc-defg-hij', 'status': 'draft', 'joined': 9}).single;
      expect((w.data['classId'], w.data['status'], w.data.containsKey('joined'), w.data['createdAt']), ('cls_10B', 'draft', false, _now.toIso8601String()));
      final back = a.build(ctx, {'live_classes': [{...w.data, 'id': 'lc_2'}], LiveClassesAdapter.joinsSource: [{'id': 'lc_2', 'count': 3}]}).single;
      expect((back['joined'], back['audience'], back.containsKey('teacherId')), (3, 'Class 10-B', false));
    });

    test('marks: updatedAt stamped; a locked paper, a locked cycle or a published class writes nothing', () {
      const a = MarksAdapter();
      final row = {'examId': 'pap_1@cls_10B', 'studentId': 'stu_1', 'marks': 40, 'status': 'Present'};
      final open = {'exm_papers': [{'id': 'pap_1', 'cycleId': 'c1'}], 'exm_cycles': [{'id': 'c1'}]};
      final w = a.write(ctx, open, row).single;
      expect((w.data['updatedAt'], w.data['enteredAt'], w.data['updatedBy']), (_now.toIso8601String(), _now.toIso8601String(), 'uid1'));
      expect(a.write(ctx, {'exm_papers': [{'id': 'pap_1', 'locked': true}]}, row), isEmpty);
      expect(a.write(ctx, {'exm_papers': [{'id': 'pap_1', 'cycleId': 'c1'}], 'exm_cycles': [{'id': 'c1', 'locked': true}]}, row), isEmpty);
      expect(a.write(ctx, {'exm_papers': [{'id': 'pap_1', 'published': ['10-B']}]}, row), isEmpty);
      // another class of the same paper is still open
      expect(a.write(ctx, {'exm_papers': [{'id': 'pap_1', 'published': ['10-A']}]}, row), hasLength(1));
      expect(a.queries(ctx, {}).map((q) => q.collection), containsAll(['exm_marks', 'exm_papers', 'exm_cycles']));
      expect(paperLocked({'published': ['cls_10B']}, null, 'cls_10B'), isTrue);
      expect(paperLocked({}, null, null), isFalse);
    });

    test('staff leaves: new and edited requests are Pending; withdraw deletes + private copy; decided ones are read-only', () {
      const a = StaffLeavesAdapter();
      final remote = {
        'staff_leaves': [
          {'id': 'l1', 'staffId': 'stf_025', 'status': 'Pending', 'from': '2026-11-10', 'to': '2026-11-10', 'type': 'Casual Leave', 'days': 1, 'createdAt': '2026-11-01T10:00:00'},
          {'id': 'l2', 'staffId': 'stf_025', 'status': 'Approved', 'from': '2026-11-20', 'to': '2026-11-21', 'type': 'Casual Leave', 'days': 2},
        ],
      };
      final create = a.write(ctx, remote, {'id': 'l3', 'type': 'Medical Leave', 'from': '2026-11-12', 'to': '2026-11-13', 'days': 2, 'status': 'Approved'}).single;
      expect((create.collection, create.data['status'], create.data['staffId'], create.data['teacherId'], create.data['createdAt']), ('staff_leaves', 'Pending', 'stf_025', 'stf_025', _now.toIso8601String()));
      final edit = a.write(ctx, remote, {...a.build(ctx, remote).firstWhere((r) => r['id'] == 'l1'), 'reason': 'Changed'}).single;
      expect((edit.data['status'], edit.data['createdAt'], edit.data['reason']), ('Pending', '2026-11-01T10:00:00', 'Changed'));
      expect(a.write(ctx, remote, {'id': 'l2', 'status': 'Cancelled'}), isEmpty, reason: 'approved: the office cancels it');
      expect(a.write(ctx, remote, {'id': 'l2', 'status': 'Approved', 'reason': 'x'}), isEmpty);
      final wd = a.write(ctx, remote, {'id': 'l1', 'status': 'Cancelled'});
      expect(wd.map((w) => (w.collection, w.delete)), [('staff_leaves', true), ('lm_withdrawn', false)]);
      expect(wd.last.data['status'], 'Cancelled');
      final after = {'staff_leaves': [remote['staff_leaves']![1]], 'lm_withdrawn': [{...wd.last.data, 'id': 'l1'}]};
      expect(a.build(ctx, after).map((r) => (r['id'], r['status'])), unorderedEquals([('l1', 'Cancelled'), ('l2', 'Approved')]));
      expect(a.write(ctx, after, {'id': 'l1', 'status': 'Cancelled'}), isEmpty, reason: 'already withdrawn');
      expect(a.delete(ctx, remote, {'id': 'l1'}).single.delete, isTrue);
      expect(a.delete(ctx, remote, {'id': 'l2'}), isEmpty);
      // Apply Leave view (att_leaves) reads start/end and the approver
      final att = const StaffLeavesAdapter('att_leaves').build(ctx, remote).firstWhere((r) => r['id'] == 'l2');
      expect((att['start'], att['end'], att['by']), ('2026-11-20', '2026-11-21', 'School Admin'));
    });

    test('student leaves: Clarify stays Pending + private flag; unknown statuses never reach the shared doc; no teacher creates', () {
      const slip = StudentLeavesAdapter('att_slips', src: 'slip'), lm = StudentLeavesAdapter('lm_student', src: 'lm');
      final remote = {
        'student_leaves': [{'id': 'sl_1', 'studentId': 'stu_1', 'classId': 'cls_10B', 'status': 'Pending', 'by': 'Mr. X (Father)', 'decidedBy': null}],
        'staff': [{'id': 'stf_025', 'name': 'Mrs. Anita Sharma'}],
      };
      final c = slip.write(ctx, remote, {'id': 'sl_1', 'status': 'Clarify', 'decisionNote': 'Which dates?'});
      expect(c.map((w) => w.collection), ['student_leaves', 'att_slip_state']);
      expect((c.first.data['status'], c.first.data['decisionNote'], c.first.data.containsKey('decidedBy')), ('Pending', 'Which dates?', false));
      final withFlag = {...remote, 'att_slip_state': [{...c.last.data, 'id': 'sl_1'}]};
      expect(slip.build(ctx, withFlag).single['status'], 'Clarify');
      expect(slip.build(ctx, withFlag).single['parent'], 'Mr. X (Father)');
      expect(lm.build(ctx, withFlag).single['status'], 'pending', reason: 'Leave Management sees the shared status');
      expect(slip.write(ctx, remote, {'id': 'sl_1', 'status': 'Whatever'}).first.data['status'], 'Pending');
      expect(slip.write(ctx, remote, {'id': 'new', 'status': 'Pending', 'studentId': 'stu_1'}), isEmpty);
      final decided = {
        'student_leaves': [{'id': 'sl_1', 'studentId': 'stu_1', 'classId': 'cls_10B', 'status': 'Approved', 'decidedBy': 'stf_025', 'decidedAt': '2026-11-02T10:00:00.000'}],
        'staff': [{'id': 'stf_025', 'name': 'Mrs. Anita Sharma'}],
      };
      final r = lm.build(ctx, decided).single;
      expect((r['status'], r['processedBy'], r['processedAt']), ('approved', 'by Mrs. Anita Sharma', DateTime.parse('2026-11-02T10:00:00.000').millisecondsSinceEpoch));
      final other = {...decided, 'student_leaves': [{...decided['student_leaves']!.single, 'decidedBy': 'uid_admin'}]};
      expect(lm.build(ctx, other).single['processedBy'], 'by School Office');
      expect(lm.build(ctx, {'student_leaves': [{'id': 'x', 'deleted': true}]}), isEmpty);
    });

    test('medical slips: medical student_leaves only; decisions write the decision fields', () {
      const a = MedicalSlipsAdapter();
      final remote = {
        'student_leaves': [
          {'id': 'm1', 'studentId': 'stu_1', 'classId': 'cls_10B', 'from': '2026-11-01', 'to': '2026-11-03', 'reason': 'Fever', 'cat': 'medical', 'status': 'Pending', 'by': 'Mrs. Y (Mother)', 'appliedOn': '2026-11-01', 'attachment': {'name': 'cert.pdf'}},
          {'id': 'm2', 'studentId': 'stu_2', 'classId': 'cls_10B', 'from': '2026-10-01', 'type': 'Medical Leave', 'status': 'Approved', 'decidedBy': 'stf_025', 'decisionNote': 'OK'},
          {'id': 'p1', 'studentId': 'stu_3', 'classId': 'cls_10B', 'type': 'Personal Leave', 'cat': 'leave', 'status': 'Pending'},
        ],
        'staff': [{'id': 'stf_025', 'name': 'Mrs. Anita Sharma'}],
      };
      final rows = a.build(ctx, remote);
      expect(rows.map((r) => r['id']), ['m1', 'm2']);
      expect((rows.first['title'], rows.first['days'], rows.first['file'], rows.first['uploader'], rows.first['status']), ('Fever', 3, 'cert.pdf', 'Mrs. Y (Mother)', 'Pending'));
      expect((rows.last['by'], rows.last['reason'], rows.last['days']), ('Mrs. Anita Sharma', 'OK', 1));
      final w = a.write(ctx, remote, {...rows.first, 'status': 'Approved', 'by': 'Mrs. Anita Sharma'}).single;
      expect(w.data.keys.toSet(), {'status', 'decisionNote', 'decidedBy', 'decidedAt', 'updatedAt', 'updatedBy'});
      expect((w.data['status'], w.data['decidedBy']), ('Approved', 'stf_025'));
      expect(a.write(ctx, remote, {'id': 'nope', 'status': 'Approved'}), isEmpty);
      expect(isMedicalLeave({'type': 'Medical Leave'}), isTrue);
      expect(isMedicalLeave({'cat': 'leave', 'type': 'Personal Leave'}), isFalse);
    });

    test('attendance, check-in and regularization ids and stamps', () {
      final att = const AttendanceAdapter().write(ctx, {}, {'classId': 'cls_8C', 'date': '2026-11-03', 'period': 2, 'total': 40, 'marks': {'s1': 'E'}, 'submitted': false}).single;
      expect((att.id, att.data['submitted'], att.data['updatedBy'], att.data['updatedAt']), ('2026-11-03_cls_8C_2', false, 'uid1', _now.toIso8601String()));
      final day = const StaffAttendanceAdapter().write(ctx, {}, {'date': '2026-11-03', 'in': '08:10', 'status': 'Present'}).single;
      expect((day.id, day.data['status'], day.data['source']), ('2026-11-03_stf_025', 'Present', 'app'));
      final reg = const RegularizationsAdapter().write(ctx, {}, {'id': 'rg_1', 'date': '2026-11-02', 'type': 'Both Punches', 'time': '08:00', 'reason': 'Biometric down', 'status': 'Approved'}).single;
      expect((reg.collection, reg.data['status'], reg.data['type'], reg.data['at']), ('staff_regularizations', 'Pending', 'Both Punches', _now.toIso8601String()));
    });

    test('circulars write only the private read/ack/pin state', () {
      final w = const CircularsAdapter().write(ctx, {}, {'id': 'ntc_1', 'title': 'x', 'read': true, 'ack': true, 'pinned': false, 'ackAt': 'now'}).single;
      expect((w.collection, w.id), ('att_circulars', 'ntc_1'));
      expect(w.data.keys.toSet(), {'read', 'ack', 'pinned', 'ackAt', 'teacherId', 'updatedAt', 'updatedBy'});
    });

    test('exam duty and candidate overlays carry the staff id in their ids', () {
      final d = const ExamDutiesAdapter().write(ctx, {}, {'id': 'dut_1', 'swap': 'pending', 'checked': [1], 'role': 'ignored'}).single;
      expect((d.collection, d.id, d.data.containsKey('role')), ('ed_duty_state', 'dut_1_stf_025', false));
      final c = const ExamCandidatesAdapter().write(ctx, {}, {'id': 'dut_1__cand_stu_1', 'dutyId': 'dut_1', 'candId': 'cand_stu_1', 'status': 'absent', 'name': 'ignored'}).single;
      expect((c.collection, c.id, c.data['status'], c.data.containsKey('name')), ('ed_cand_state', 'dut_1__cand_stu_1_stf_025', 'absent', false));
    });
  });

  test('defaultAdapters has no duplicate local names and covers every shared teacher-local name of contract §4', () {
    final locals = [for (final a in defaultAdapters()) a.local];
    expect(locals.toSet().length, locals.length);
    expect(locals, containsAll(['att_records', 'tk_homework', 'att_marks', 'lm_my', 'lm_student', 'att_slips', 'lv_sessions', 'att_staff', 'att_regs', 'ed_duties', 'ms_messages']));
  });
}
