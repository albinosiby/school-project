import 'package:teacher_app/utils/services/data_store.dart' show Rec;
import 'package:flutter_test/flutter_test.dart';
import 'package:school_sync/school_sync.dart';
import 'package:teacher_app/modules/home/models/timetable_models.dart' as timetable;
import 'package:teacher_app/modules/attendance/models/attendance_models.dart';
import 'package:teacher_app/utils/services/firebase/store_adapters.dart';
import 'package:teacher_app/modules/school/models/school_models.dart';
import 'package:teacher_app/modules/school/repositories/school_repository_interface.dart';
import 'package:teacher_app/modules/lessons/models/teaching_options.dart';
import 'package:teacher_app/modules/attendance/repositories/attendance_repository_interface.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_bloc.dart';
import 'package:teacher_app/modules/attendance/bloc/mark_attendance_events.dart';
import 'package:teacher_app/modules/attendance/bloc/load_status.dart';

class _EmptySchool implements ISchoolRepository {
  @override
  Future<List<SchoolClass>> getClasses() async => [];
  @override
  Future<Teacher> getTeacher() async => Teacher.fromJson({});
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnsupportedError('Unexpected school operation');
}

class _EmptyAttendance implements IAttendanceRepository {
  @override
  Stream<void> watch() => const Stream.empty();
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnsupportedError('Unexpected attendance operation');
}

void main() {
  tearDown(SchoolPolicyRuntime.clear);
  test('missing bell settings or class assignment produces an empty state without throwing', () async {
    final bloc = MarkAttendanceBloc(_EmptyAttendance(), _EmptySchool());
    final loaded = bloc.stream.firstWhere((state) => state.status == LoadStatus.loaded);
    bloc.add(const MarkAttendanceLoadRequested());
    expect((await loaded).classId, '');
    await bloc.close();
  });
  test('subject options require both a profile subject and an active class assignment', () {
    final teacher = Teacher.fromJson({
      'subjectNames': ['English', 'Maths'],
    });
    final classes = [
      SchoolClass.fromJson({
        'id': 'cls_UKGA',
        'grade': 'UKG',
        'section': 'A',
        'subjects': ['English', 'Science'],
      }),
    ];
    expect(teachingSubjects(teacher, classes, 'UKG-A'), ['English']);
    expect(teachingSubjects(teacher, [], 'UKG-A'), isEmpty);
  });
  test('another teacher submitted class sheet is available for history but is read-only', () {
    const ctx = AdapterContext(schoolId: 's1', staffId: 't1', authUid: 'u1');
    final remote = <String, List<Rec>>{
      'assignments': [
        {'teacherId': 't1', 'classId': 'cls_UKGA'},
      ],
      'ops_attendance': [
        {'id': 'a1', 'classId': 'cls_UKGA', 'teacherId': 't2', 'date': '2026-11-21', 'period': 1, 'submitted': true},
      ],
    };
    final row = const AttendanceAdapter().build(ctx, remote).single;
    expect(AttendanceRecord.fromJson(row).readOnly, true);
  });
  test('teacher timetable and attendance share the configured bell schedule', () {
    SchoolPolicyRuntime.current = SchoolPolicy.fromJson({
      'minimumAttendance': 82.5,
      'utcOffsetMinutes': 330,
      'workingDays': [1, 2, 3, 4, 5],
      'schedule': [
        {'label': 'Period 1', 'start': '09:00', 'end': '09:40'},
        {'label': 'Lunch', 'start': '09:40', 'end': '10:10', 'isBreak': true},
        {'label': 'Period 2', 'start': '10:10', 'end': '10:50'},
      ],
    });
    expect(timetable.kSlots.length, 3);
    expect(timetable.kSlots[1].isBreak, true);
    expect(timetable.slotOf('P2').start, '10:10');
    expect(timetable.slotOf('P8').start, '');
    expect(periodTimes.keys, [1, 2]);
    expect(minimumAttendance, 82.5);
    expect(timetable.schoolWorkingDays, [1, 2, 3, 4, 5]);
  });
  test('out of hours uses the real school clock instead of simulated Monday', () {
    final now = timetable.schoolNow(DateTime.utc(2026, 11, 22, 16));
    expect(now.simulated, false);
    expect(now.day, DateTime.sunday);
    expect(now.at.hour, 21);
  });
  test('empty attendance is zero and kindergarten grade identities are preserved', () {
    expect(studentRate([], 'kid'), 0);
    expect(classLabelOf('cls_LKGA'), 'LKG-A');
    expect(classLabelOf('cls_UKGB'), 'UKG-B');
    expect(dayNumber('Sun'), 7); expect(dayName(7), 'Sun');
  });
  test('configured class room is used when a subject period has no room override', () {
    final rows = const PeriodsAdapter().build(AdapterContext(schoolId: 's1', staffId: 't1', authUid: 'u1'), {
      'classes': [
        {'id': 'cls_UKGA', 'room': '101'},
      ],
      'ops_periods': [
        {'id': 'p1', 'teacherId': 't1', 'classId': 'cls_UKGA', 'day': 'Mon', 'period': 1, 'subject': 'English'},
      ],
    });
    expect(rows.single['room'], '101');
  });
}
