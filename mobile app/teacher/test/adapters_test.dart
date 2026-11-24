// Adapter unit tests (pure, no Firebase): read mapping, write mapping, id schemes and stamp fields of every
// StoreAdapter, plus a rules-conformance sweep over all of them (see website/firestore.rules, teacher section).
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/injection.dart';
import 'package:teacher_app/modules/attendance/models/marks_models.dart';
import 'package:teacher_app/utils/services/data_store.dart';
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
  if (q.collection == 'exm_sheets') return q.eq['ownerId'] == staffId; // EXAMS_SHEETS_RESULTS_CONTRACT §2 Rules
  if (const {'staff_leaves', 'staff_attendance', 'staff_regularizations'}.contains(q.collection)) return q.eq['staffId'] == staffId;
  // own HR card and photo: read by document id only (rules: docId == staff)
  if (const {'staff_self', 'staff_hr_photos'}.contains(q.collection)) return q.eq['__name__'] == staffId;
  if (_private.hasMatch(q.collection) || const {'msg_threads', 'msg_messages', 'msg_meetings', 'ptm_slots', 'ptm_bookings'}.contains(q.collection)) return q.eq['teacherId'] == staffId;
  return false;
}

/// Would the teacher rules allow this write (collection + owner fields; per-field checks are in the adapter tests)?
bool writeAllowed(RemoteWrite w, String staffId) {
  final d = w.data;
  switch (w.collection) {
    case 'ops_attendance' || 'ops_homework' || 'exm_marks' || 'live_classes':
      return !w.delete && d['teacherId'] == staffId;
    case 'exm_sheets':
      // owner submit only: onlyKeys([status, submittedAt, submittedBy, updatedAt, updatedBy]), status Submitted, submittedBy == me
      return !w.delete &&
          d.keys.toSet().difference({'status', 'submittedAt', 'submittedBy', 'updatedAt', 'updatedBy'}).isEmpty &&
          d['status'] == 'Submitted' &&
          d['submittedBy'] == staffId;
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
    case 'msg_meetings':
      // own thread's meeting; `reminders` may only be cleared, never set
      return !w.delete && d['teacherId'] == staffId && (!d.containsKey('reminders') || (d['reminders'] as Map).isEmpty) && const {'scheduled', 'cancelled'}.contains(d['status']);
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
      expect(paperLocked({'lockedClassIds': ['cls_10B']}, null, 'cls_10B'), isTrue);
      expect(paperLocked({'lockedClassIds': ['cls_10B']}, null, 'cls_10A'), isFalse);
      expect(paperLocked({'publishedClassIds': ['custom11']}, null, 'custom11'), isTrue);
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

  group('mark sheets (EXAMS_SHEETS_RESULTS_CONTRACT §4)', () {
    const comps = {'mode': 'marks', 'theory': 80, 'practical': 20, 'internal': 0, 'passMarks': 33, 'gradeOptions': <String>[]};
    Rec sheet(String paper, String cls, String status, {Map<String, dynamic> components = comps, List<String> roster = const ['stu_1', 'stu_2'], Map<String, dynamic> more = const {}}) => {
          'id': '${paper}__$cls', 'paperId': paper, 'classId': cls, 'cycleId': 'cyc_1', 'subject': 'Mathematics', 'ownerId': 'stf_025',
          'components': components, 'rosterIds': roster, 'status': status, ...more,
        };
    final Remote remote = {
      'exm_cycles': [{'id': 'cyc_1', 'short': 'Half-Yearly'}],
      'exm_papers': [
        {'id': 'pap_a', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'classIds': ['cls_10A', 'cls_10B'], 'date': '2026-11-10'},
        {'id': 'pap_b', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'classIds': ['cls_10B'], 'date': '2026-11-11'},
        {'id': 'pap_c', 'cycleId': 'cyc_1', 'grade': '10', 'subject': 'Mathematics', 'theory': 80, 'classIds': ['cls_10B'], 'date': '2026-11-12', 'locked': true},
      ],
      'assignments': [{'id': 'a1', 'teacherId': 'stf_025', 'classId': 'cls_10B', 'subject': 'Mathematics'}],
      'att_exam_state': [{'id': 'pap_b@cls_10B', 'status': 'Submitted', 'submittedAt': '2026-11-12', 'teacherId': 'stf_025'}],
      'exm_sheets': [
        sheet('pap_a', 'cls_10B', 'NotStarted'),
        sheet('pap_a', 'cls_10A', 'InProgress'), // a class I am not assigned to: the sheet alone lists it
        sheet('pap_c', 'cls_10B', 'Returned', more: {'returnNote': 'Roll 7 looks swapped with roll 8'}),
        sheet('pap_d', 'cls_10B', 'Submitted', more: {'submittedAt': '2026-11-13T10:00:00'}),
        sheet('pap_e', 'cls_10B', 'Approved'),
        sheet('pap_f', 'cls_10B', 'Locked'),
        sheet('pap_g', 'cls_10B', 'InProgress', components: {'mode': 'grade', 'theory': 0, 'practical': 0, 'internal': 0, 'passMarks': 0, 'gradeOptions': ['A', 'B', 'C']}),
        {...sheet('pap_h', 'cls_10B', 'InProgress'), 'ownerId': 'stf_999'}, // someone else's: never listed
      ],
    };

    test('listing: one exam per owned sheet, status mapped, legacy rows only for papers without a sheet', () {
      const a = ExamsAdapter();
      expect(a.queries(ctx, remote).map((q) => q.key), contains(RemoteQuery('exm_sheets', eq: {'ownerId': 'stf_025'}).key));
      final rows = {for (final r in a.build(ctx, remote)) '${r['id']}': r};
      expect(rows.keys.toSet(), {'pap_a@cls_10B', 'pap_a@cls_10A', 'pap_b@cls_10B', 'pap_c@cls_10B', 'pap_d@cls_10B', 'pap_e@cls_10B', 'pap_f@cls_10B', 'pap_g@cls_10B'});
      expect({for (final e in rows.entries) e.key: e.value['status']}, {
        'pap_a@cls_10B': 'Draft', 'pap_a@cls_10A': 'Draft', 'pap_b@cls_10B': 'Submitted', 'pap_c@cls_10B': 'Returned', 'pap_d@cls_10B': 'Submitted',
        'pap_e@cls_10B': 'Locked', 'pap_f@cls_10B': 'Locked', 'pap_g@cls_10B': 'Draft',
      });
      final s = rows['pap_a@cls_10B']!;
      expect((s['hasSheet'], s['sheetId'], s['classId'], s['name'], s['subject'], s['max'], s['date']), (true, 'pap_a__cls_10B', 'cls_10B', 'Half-Yearly', 'Mathematics', 80, '2026-11-10'));
      expect(s['components'], comps);
      expect(s['rosterIds'], ['stu_1', 'stu_2']);
      expect(s['studentIds'], ['stu_1', 'stu_2'], reason: 'the roster also drives the legacy studentIds filter');
      expect(rows['pap_c@cls_10B']!['returnNote'], 'Roll 7 looks swapped with roll 8');
      expect(rows['pap_c@cls_10B']!['status'], 'Returned', reason: 'a Returned sheet is editable even though the legacy paper is locked');
      expect(rows['pap_d@cls_10B']!['submittedAt'], '2026-11-13T10:00:00');
      expect(rows['pap_a@cls_10B']!.containsKey('returnNote'), isFalse);
      // legacy row: assignment based, att_exam_state status, no sheet fields
      final legacy = rows['pap_b@cls_10B']!;
      expect((legacy['hasSheet'], legacy['status'], legacy['submittedAt'], legacy.containsKey('components')), (null, 'Submitted', '2026-11-12', false));
      // the Exam model reads the sheet fields
      final ex = Exam.fromJson(s);
      expect((ex.hasSheet, ex.readOnly, ex.maxTotal, ex.components!.practical), (true, false, 100, 20));
      expect(ex.rosterIds, ['stu_1', 'stu_2']);
      expect(Exam.fromJson(rows['pap_d@cls_10B']!).readOnly, isTrue, reason: 'Submitted sheet is read-only');
      expect(Exam.fromJson(rows['pap_c@cls_10B']!).readOnly, isFalse, reason: 'Returned sheet is editable');
      expect(Exam.fromJson(rows['pap_e@cls_10B']!).lockedByAdmin, isTrue);
      expect(Exam.fromJson(rows['pap_g@cls_10B']!).gradeOnly, isTrue);
      expect(Exam.fromJson(legacy).readOnly, isFalse, reason: 'legacy Submitted still takes edits with a reason');
      expect(sheetLocalStatus('Whatever'), 'Draft');
      // the roster of a sheet-only class (cls_10A: no assignment) is still loaded: students and classes follow owned sheets
      expect(examClassIds(ctx, remote), ['cls_10A', 'cls_10B']);
      final studentIn = const StudentsAdapter().queries(ctx, remote).where((q) => q.inField == 'classId').expand((q) => q.inValues);
      expect(studentIn, containsAll(['cls_10A', 'cls_10B']));
      expect(const StudentsAdapter().queries(ctx, remote).map((q) => q.key), contains(ownedSheetsQuery(ctx).key));
      expect(const ClassesAdapter().queries(ctx, remote).map((q) => q.key), contains(ownedSheetsQuery(ctx).key));
    });

    test('marks: with a sheet every component is written; range, roster and sheet status are enforced', () {
      const a = MarksAdapter();
      expect(a.queries(ctx, remote).map((q) => q.key), contains(RemoteQuery('exm_sheets', eq: {'ownerId': 'stf_025'}).key));
      final row = {'examId': 'pap_a@cls_10B', 'studentId': 'stu_1', 'status': 'Present', 'marks': 70, 'practical': 15, 'internal': null, 'gradeValue': '', 'tag': 'Consistent', 'note': 'Good'};
      final w = a.write(ctx, remote, row).single;
      expect((w.collection, w.id), ('exm_marks', 'pap_a__cand_stu_1'));
      expect(w.data.keys.toSet(), {'paperId', 'candId', 'studentId', 'classId', 'theory', 'practical', 'internal', 'gradeValue', 'status', 'tag', 'note', 'teacherId', 'enteredAt', 'updatedAt', 'updatedBy'});
      expect((w.data['theory'], w.data['practical'], w.data['internal'], w.data['gradeValue'], w.data['classId'], w.data['teacherId'], w.data['enteredAt']), (70, 15, null, '', 'cls_10B', 'stf_025', _now.toIso8601String()));
      expect(writeAllowed(w, 'stf_025'), isTrue);
      // out of range, not rostered, sheet not open -> nothing is written (the rules would reject it)
      expect(a.write(ctx, remote, {...row, 'marks': 81}), isEmpty, reason: 'theory above max');
      expect(a.write(ctx, remote, {...row, 'practical': 21}), isEmpty, reason: 'practical above max');
      expect(a.write(ctx, remote, {...row, 'internal': 1}), isEmpty, reason: 'internal max is 0');
      expect(a.write(ctx, remote, {...row, 'marks': -1}), isEmpty);
      expect(a.write(ctx, remote, {...row, 'studentId': 'stu_9'}), isEmpty, reason: 'not in rosterIds');
      expect(a.write(ctx, remote, {...row, 'examId': 'pap_d@cls_10B'}), isEmpty, reason: 'Submitted');
      expect(a.write(ctx, remote, {...row, 'examId': 'pap_e@cls_10B'}), isEmpty, reason: 'Approved');
      expect(a.write(ctx, remote, {...row, 'examId': 'pap_f@cls_10B'}), isEmpty, reason: 'Locked');
      expect(a.write(ctx, remote, {...row, 'examId': 'pap_c@cls_10B'}), hasLength(1), reason: 'Returned: editable, and the legacy paper lock no longer applies');
      // grade-only sheet: gradeValue from the options, numeric components null
      final g = a.write(ctx, remote, {'examId': 'pap_g@cls_10B', 'studentId': 'stu_2', 'status': 'Present', 'gradeValue': 'B'}).single;
      expect((g.data['gradeValue'], g.data['theory'], g.data['practical'], g.data['internal']), ('B', null, null, null));
      expect(a.write(ctx, remote, {'examId': 'pap_g@cls_10B', 'studentId': 'stu_2', 'status': 'Present', 'gradeValue': 'Z'}), isEmpty, reason: 'not a grade option');
      // an absent student carries no marks
      final ab = a.write(ctx, remote, {'examId': 'pap_a@cls_10B', 'studentId': 'stu_2', 'status': 'Medical Slip'}).single;
      expect((ab.data['status'], ab.data['theory'], ab.data['practical']), ('Medical Slip', null, null));
      // reading back
      final local = a.build(ctx, {'exm_marks': [{...w.data, 'id': w.id}]}).single;
      expect((local['examId'], local['marks'], local['practical'], local['internal'], local['gradeValue'], local['status']), ('pap_a@cls_10B', 70, 15, null, '', 'Present'));
      final m = StudentMark.fromJson(local);
      expect((m.total, m.entered, m.componentOf('practical')), (85, true, 15));
    });

    test('marks: without a sheet the legacy theory-only write is unchanged', () {
      const a = MarksAdapter();
      final w = a.write(ctx, remote, {'examId': 'pap_b@cls_10B', 'studentId': 'stu_1', 'status': 'Present', 'marks': 40, 'practical': 15, 'internal': 9}).single;
      expect(w.data.keys.toSet(), {'paperId', 'candId', 'studentId', 'classId', 'theory', 'status', 'tag', 'note', 'teacherId', 'enteredAt', 'updatedAt', 'updatedBy'});
      expect(w.data['theory'], 40);
      expect(w.data.keys, isNot(contains('internal')));
      expect(w.data.keys, isNot(contains('practical')));
      expect(a.write(ctx, remote, {'examId': 'pap_b@cls_10B', 'studentId': 'stu_1', 'marks': 81}), hasLength(1), reason: 'legacy has no component maxima here (the screen validates)');
      // the sheet of another teacher (pap_h) does not exist for me: the write falls to the legacy path and there is no paper to lock it
      expect(a.write(ctx, remote, {'examId': 'pap_h@cls_10B', 'studentId': 'stu_1', 'marks': 1}).single.data.keys, isNot(contains('practical')));
    });

    test('submit: a sheet exam writes only the sheet transition; no att_exam_state; read-only states write nothing', () {
      const a = ExamsAdapter();
      final rows = {for (final r in a.build(ctx, remote)) '${r['id']}': r};
      final w = a.write(ctx, remote, {...rows['pap_a@cls_10B']!, 'status': 'Submitted', 'submittedAt': '2026-11-14T09:00:00'}).single;
      expect((w.collection, w.id), ('exm_sheets', 'pap_a__cls_10B'));
      expect(w.data, {'status': 'Submitted', 'submittedAt': '2026-11-14T09:00:00', 'submittedBy': 'stf_025', 'updatedAt': _now.toIso8601String(), 'updatedBy': 'uid1'});
      expect(writeAllowed(w, 'stf_025'), isTrue);
      expect(w.data.keys, isNot(contains('teacherId')), reason: 'the rules take exactly the transition keys');
      // submittedAt defaults to now
      expect(a.write(ctx, remote, {...rows['pap_c@cls_10B']!, 'status': 'Submitted', 'submittedAt': null}).single.data['submittedAt'], _now.toIso8601String());
      expect(a.write(ctx, remote, {...rows['pap_c@cls_10B']!, 'status': 'Submitted'}).single.id, 'pap_c__cls_10B', reason: 'Returned -> Submitted again');
      expect(a.write(ctx, remote, {...rows['pap_d@cls_10B']!, 'status': 'Submitted'}), isEmpty, reason: 'already Submitted');
      expect(a.write(ctx, remote, {...rows['pap_e@cls_10B']!, 'status': 'Submitted'}), isEmpty, reason: 'Approved');
      expect(a.write(ctx, remote, {...rows['pap_f@cls_10B']!, 'status': 'Submitted'}), isEmpty, reason: 'Locked');
      expect(a.write(ctx, remote, {...rows['pap_a@cls_10B']!, 'status': 'Draft'}), isEmpty, reason: 'only the submit transition exists for a sheet');
      // legacy exam: unchanged private overlay write
      final l = a.write(ctx, remote, {...rows['pap_b@cls_10B']!, 'status': 'Submitted', 'submittedAt': '2026-11-14'}).single;
      expect((l.collection, l.id, l.data['status'], l.data['teacherId']), ('att_exam_state', 'pap_b@cls_10B', 'Submitted', 'stf_025'));
      // the after-submit listing is read-only
      final after = {...remote, 'exm_sheets': [for (final s in remote['exm_sheets']!) s['id'] == 'pap_a__cls_10B' ? {...s, ...w.data} : s]};
      final ex = Exam.fromJson(a.build(ctx, after).firstWhere((r) => r['id'] == 'pap_a@cls_10B'));
      expect((ex.status, ex.readOnly, ex.submittedAt), ('Submitted', true, '2026-11-14T09:00:00'));
    });

    test('submit validation: every rostered student needs all components in range, or a non-Present status', () {
      final ex = Exam.fromJson(const ExamsAdapter().build(ctx, remote).firstWhere((r) => r['id'] == 'pap_a@cls_10B'));
      StudentMark mk(String id, {String status = 'Present', int? marks, int? practical, String grade = ''}) =>
          StudentMark(examId: ex.id, studentId: id, status: status, marks: marks, practical: practical, gradeValue: grade);
      expect(sheetSubmitProblem(ex, {}), '2 of 2 students still pending: enter every component or mark them Absent.');
      expect(sheetSubmitProblem(ex, {'stu_1': mk('stu_1', marks: 70, practical: 15)}), startsWith('1 of 2 students still pending'));
      expect(sheetSubmitProblem(ex, {'stu_1': mk('stu_1', marks: 70), 'stu_2': mk('stu_2', status: 'Absent')}), startsWith('1 of 2'), reason: 'practical missing');
      expect(sheetSubmitProblem(ex, {'stu_1': mk('stu_1', marks: 90, practical: 15), 'stu_2': mk('stu_2', status: 'Medical Slip')}), '1 mark is out of range.');
      expect(sheetSubmitProblem(ex, {'stu_1': mk('stu_1', marks: 70, practical: 15), 'stu_2': mk('stu_2', status: 'Disqualified')}), isNull);
      final g = Exam.fromJson(const ExamsAdapter().build(ctx, remote).firstWhere((r) => r['id'] == 'pap_g@cls_10B'));
      expect(sheetSubmitProblem(g, {'stu_1': mk('stu_1', grade: 'A'), 'stu_2': mk('stu_2', grade: 'B')}), isNull);
      expect(sheetSubmitProblem(g, {'stu_1': mk('stu_1', grade: 'A'), 'stu_2': mk('stu_2')}), startsWith('1 of 2'));
      // stats count any entered component and average totals against the sheet maximum (100)
      final st = examStats(ex, ['stu_1', 'stu_2'], {'stu_1': mk('stu_1', marks: 70, practical: 15), 'stu_2': mk('stu_2', status: 'Absent')});
      expect((st.graded, st.pending, st.absent, st.avg), (2, 0, 1, 85.0));
    });
  });

  test('defaultAdapters has no duplicate local names and covers every shared teacher-local name of contract §4', () {
    final locals = [for (final a in defaultAdapters()) a.local];
    expect(locals.toSet().length, locals.length);
    expect(locals, containsAll(['att_records', 'tk_homework', 'att_marks', 'lm_my', 'lm_student', 'att_slips', 'lv_sessions', 'att_staff', 'att_regs', 'ed_duties', 'ms_messages']));
  });
}
