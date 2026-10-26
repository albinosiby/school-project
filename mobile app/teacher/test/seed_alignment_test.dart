import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/di/demo_fixture.g.dart';
import 'package:teacher_app/di/seed_data.dart';

void main() {
  final seed = buildSeed();

  test('teacher and school come from the demo fixture', () {
    final me = seed['me']!.single;
    expect(me['name'], 'Mrs. Anita Sharma');
    expect(me['staffId'], 'stf_025');
    expect(me['school'], 'Greenfield International School');
    expect(me['year'], 'AY 2026-27');
    expect(me['term'], 'Term 2');
    expect(me['email'], 'anita.sharma@greenfield.edu');
  });

  test('classes and rosters match the contract ids and counts', () {
    expect(seed['classes']!.map((c) => c['id']), ['cls_10B', 'cls_9A', 'cls_8C', 'cls_10A']);
    final counts = {for (final c in seed['classes']!) c['id']: seed['students']!.where((s) => s['classId'] == c['id']).length};
    expect(counts, {'cls_10B': 42, 'cls_9A': 38, 'cls_8C': 40, 'cls_10A': 48});
    expect(seed['classes']!.firstWhere((c) => c['id'] == 'cls_10B')['classTeacher'], true);
    final first = seed['students']!.first;
    expect([first['id'], first['name'], first['roll'], first['guardian']], ['stu_101', 'Aarav Sharma', 1, 'Mr. Sharma']);
  });

  test('timetable = her fixture periods plus teacher-only extras; substitutions from the fixture', () {
    final periods = seed['tt_periods']!;
    expect(periods.length, 36);
    final mine = fixturePeriods.where((p) => p['teacherId'] == 'stf_025').length;
    expect(periods.where((p) => p['kind'] == 'core').length, mine);
    expect(seed['tt_subs']!.map((s) => s['id']), fixtureSubstitutions.where((s) => s['substituteTeacherId'] == 'stf_025').map((s) => s['id']));
    expect(periods.where((p) => p['kind'] == 'sub').map((p) => p['subId']).toSet(), {'sub_1', 'sub_2', 'sub_3'});
  });

  test('no seed still uses the old ids or school', () {
    final all = jsonEncode(seed);
    expect(RegExp(r'"c_(10|9|8)[abc]"').hasMatch(all), isFalse);
    expect(RegExp(r'"stu_\d{1,2}"').hasMatch(all), isFalse);
    expect(all.contains("St. Xavier"), isFalse);
    expect(all.contains('AY 2024'), isFalse);
    final ids = {for (final s in fixtureStudents) s['id']};
    for (final r in [...seed['att_records']!, ...seed['att_marks']!]) {
      for (final id in [if (r['studentId'] != null) r['studentId'], ...((r['marks'] is Map) ? (r['marks'] as Map).keys : const [])]) {
        expect(ids.contains(id), isTrue, reason: '$id');
      }
    }
  });
}
