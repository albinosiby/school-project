import 'package:equatable/equatable.dart';
import '../../../utils/helpers/date_helper.dart';

enum AttendanceStatus { present, absent, late, halfDay, leave, holiday }

extension AttendanceStatusX on AttendanceStatus {
  String get label => switch (this) {
    AttendanceStatus.present => 'Present',
    AttendanceStatus.absent => 'Absent',
    AttendanceStatus.late => 'Late',
    AttendanceStatus.halfDay => 'Half day',
    AttendanceStatus.leave => 'On leave',
    AttendanceStatus.holiday => 'Holiday',
  };
}

class AttendanceRecord extends Equatable {
  const AttendanceRecord({required this.date, required this.status, this.note});
  final DateTime date;
  final AttendanceStatus status;
  final String? note;

  @override
  List<Object?> get props => [date, status, note];
}

class AttendanceSummary extends Equatable {
  const AttendanceSummary({
    required this.present,
    required this.absent,
    required this.late,
    required this.halfDay,
    required this.leave,
  });
  final int present, absent, late, halfDay, leave;

  factory AttendanceSummary.of(Iterable<AttendanceRecord> records) {
    int c(AttendanceStatus s) => records.where((r) => r.status == s).length;
    return AttendanceSummary(
      present: c(AttendanceStatus.present),
      absent: c(AttendanceStatus.absent),
      late: c(AttendanceStatus.late),
      halfDay: c(AttendanceStatus.halfDay),
      leave: c(AttendanceStatus.leave),
    );
  }

  /// School days counted (holidays are excluded).
  int get workingDays => present + absent + late + halfDay + leave;

  /// Late counts as attended, half day as half. Leave counts as not attended. 0..100.
  double get percentage => workingDays == 0
      ? 0
      : (present + late + halfDay * 0.5) / workingDays * 100;

  @override
  List<Object?> get props => [present, absent, late, halfDay, leave];
}

/// A term of daily records for one child.
class AttendanceData extends Equatable {
  const AttendanceData(this.records);
  final List<AttendanceRecord> records;

  AttendanceSummary get overall => AttendanceSummary.of(records);

  Iterable<AttendanceRecord> forMonth(DateTime month) => records.where(
    (r) => r.date.year == month.year && r.date.month == month.month,
  );
  AttendanceSummary summaryFor(DateTime month) =>
      AttendanceSummary.of(forMonth(month));

  AttendanceRecord? on(DateTime day) {
    for (final r in records) {
      if (sameDay(r.date, day)) return r;
    }
    return null;
  }

  /// Absent / on-leave days, newest first.
  List<AttendanceRecord> get absences =>
      records
          .where(
            (r) =>
                r.status == AttendanceStatus.absent ||
                r.status == AttendanceStatus.leave,
          )
          .toList()
        ..sort((a, b) => b.date.compareTo(a.date));

  DateTime get firstMonth => records.isEmpty
      ? today()
      : records.map((r) => r.date).reduce((a, b) => a.isBefore(b) ? a : b);

  @override
  List<Object?> get props => [records];
}
