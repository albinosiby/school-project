import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/di/demo_data.dart';
import 'package:parent_app/modules/attendance/models/attendance_models.dart';
import 'package:parent_app/modules/fees/models/fee_models.dart';
import 'package:parent_app/modules/homework/models/homework_models.dart';
import 'package:parent_app/modules/marks/models/marks_models.dart';
import 'package:parent_app/utils/services/cache_service.dart';

AttendanceRecord _r(int d, AttendanceStatus s) =>
    AttendanceRecord(date: DateTime(2026, 10, d), status: s);

void main() {
  test(
    'attendance percentage: late counts, half day is half, holiday excluded',
    () {
      final s = AttendanceSummary.of([
        _r(1, AttendanceStatus.present),
        _r(2, AttendanceStatus.present),
        _r(3, AttendanceStatus.late),
        _r(4, AttendanceStatus.halfDay),
        _r(5, AttendanceStatus.absent),
        _r(6, AttendanceStatus.holiday),
      ]);
      expect(s.workingDays, 5);
      expect(s.percentage, closeTo((2 + 1 + 0.5) / 5 * 100, 0.001));
    },
  );

  test('marks totals and grades', () {
    final e = ExamResult(
      id: 'e',
      name: 'T',
      date: _d,
      subjects: [
        SubjectMark(subject: 'A', obtained: 45, max: 50),
        SubjectMark(subject: 'B', obtained: 30, max: 50),
      ],
    );
    expect(e.obtained, 75);
    expect(e.percent, 75);
    expect(e.grade, 'B+');
    expect(gradeFor(95), 'A+');
    expect(gradeFor(39), 'E');
    expect(ExamResult(id: 'u', name: 'Up', date: _d).published, isFalse);
  });

  test('homework status is derived from the clock', () {
    final now = DateTime(2026, 11, 2, 10);
    Homework hw({
      DateTime? due,
      bool submitted = false,
      bool reviewed = false,
    }) => Homework(
      id: 'h',
      subject: 'S',
      title: 'T',
      description: 'D',
      assignedOn: now,
      due: due ?? now,
      teacher: 'X',
      submitted: submitted,
      reviewed: reviewed,
    );
    expect(hw().statusAt(now), HomeworkStatus.pending);
    expect(
      hw(due: DateTime(2026, 11, 1)).statusAt(now),
      HomeworkStatus.overdue,
    );
    expect(
      hw(due: DateTime(2026, 11, 1), submitted: true).statusAt(now),
      HomeworkStatus.submitted,
    );
    expect(
      hw(submitted: true, reviewed: true).statusAt(now),
      HomeworkStatus.reviewed,
    );
  });

  test('invoice status and fee totals', () {
    final now = DateTime(2026, 11, 2);
    final fees = DemoData.fees(DemoData.aarav.id, now: now);
    expect(fees.total, fees.paid + fees.balance);
    expect(fees.invoices.first.statusAt(now), InvoiceStatus.paid);
    expect(fees.invoices[1].statusAt(now), InvoiceStatus.overdue);
    expect(fees.invoices[2].statusAt(now), InvoiceStatus.due);
  });

  group('cacheFirst (stale-while-revalidate)', () {
    test('cache miss: fetch, save, emit once', () async {
      final cache = CacheService();
      final out = await cacheFirst<String>(
        cache: cache,
        key: 'k',
        fetch: () async => 'fresh',
      ).toList();
      expect(out, ['fresh']);
      expect(cache.read<String>('k'), 'fresh');
    });

    test('cache hit: emits cached first, then fresh', () async {
      final cache = CacheService()..write('k', 'stale');
      final out = await cacheFirst<String>(
        cache: cache,
        key: 'k',
        fetch: () async => 'fresh',
      ).toList();
      expect(out, ['stale', 'fresh']);
      expect(cache.read<String>('k'), 'fresh');
    });

    test('failed refresh keeps the cached value and emits no error', () async {
      final cache = CacheService()..write('k', 'stale');
      final out = await cacheFirst<String>(
        cache: cache,
        key: 'k',
        fetch: () async => throw Exception('offline'),
      ).toList();
      expect(out, ['stale']);
    });

    test('failed fetch without cache surfaces the error', () async {
      expect(
        cacheFirst<String>(
          cache: CacheService(),
          key: 'k',
          fetch: () async => throw Exception('offline'),
        ).toList(),
        throwsException,
      );
    });
  });
}

final _d = DateTime(2026, 10, 1);
