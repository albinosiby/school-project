import 'package:equatable/equatable.dart';
import '../models/attendance_models.dart';
import '../models/leave_models.dart';
import 'load_status.dart';

/// Shift timings of the staff self-log.
const shiftStart = '08:00', shiftEnd = '16:30', onTimeBy = '08:30', unlockAt = '16:00';
const shiftMinutes = 510;

class SelfLogState extends Equatable {
  const SelfLogState({this.status = LoadStatus.initial, this.logs = const [], this.regs = const [], this.quota = const []});
  final LoadStatus status;
  final List<StaffLog> logs;
  final List<Regularization> regs;
  final List<LeaveQuota> quota;

  StaffLog? get today => logs.where((r) => r.date == dkey(todayDate())).firstOrNull;
  List<StaffLog> get sorted => [...logs]..sort((a, b) => b.date.compareTo(a.date));
  List<StaffLog> get thisMonth {
    final t = todayDate();
    final from = dkey(DateTime(t.year, t.month, 1));
    return [for (final r in logs) if (r.date.compareTo(from) >= 0) r];
  }

  int get workingDays {
    final t = todayDate();
    var n = 0;
    for (var d = DateTime(t.year, t.month, 1); !d.isAfter(t); d = d.add(const Duration(days: 1))) {
      if (d.weekday <= 5) n++;
    }
    return n;
  }

  int get present => thisMonth.where((r) => r.status == 'Present' || r.status == 'Late').length;
  int get late => thisMonth.where((r) => r.status == 'Late').length;
  int get leaves => thisMonth.where((r) => r.status == 'Leave').length;
  int get missed => thisMonth.where((r) => r.status == 'Irregular').length;
  double get onTime => present == 0 ? 0 : (present - late) * 100 / present;

  /// Consecutive "Present" days, newest first.
  int get streak {
    var n = 0;
    for (final r in sorted) {
      if (r.status != 'Present') break;
      n++;
    }
    return n;
  }

  /// Most recent day with a missed punch.
  StaffLog? get lastIrregular => sorted.where((r) => r.status == 'Irregular').firstOrNull;

  SelfLogState copyWith({LoadStatus? status, List<StaffLog>? logs, List<Regularization>? regs, List<LeaveQuota>? quota}) =>
      SelfLogState(status: status ?? this.status, logs: logs ?? this.logs, regs: regs ?? this.regs, quota: quota ?? this.quota);

  @override
  List<Object?> get props => [status, logs, regs, quota];
}
