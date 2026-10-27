import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../../timetable/models/timetable_models.dart';

/// "Today's Schedule": the current (or next) period highlighted, then the following periods with
/// breaks of 15+ minutes between them.
class HomeSchedule extends StatelessWidget {
  const HomeSchedule({
    super.key,
    required this.periods,
    required this.isSchoolDay,
    required this.now,
  });
  final List<Period> periods;
  final bool isSchoolDay;
  final DateTime now;

  static String _range(Period p) =>
      '${fmtTime(p.startMinute)} - ${fmtTime(p.endMinute)}';

  static String fmtTime(int m) {
    final h = m ~/ 60, mm = (m % 60).toString().padLeft(2, '0');
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '${h12.toString().padLeft(2, '0')}:$mm';
  }

  @override
  Widget build(BuildContext context) {
    if (!isSchoolDay || periods.isEmpty) {
      return AppElevatedCard(
        child: Center(
          child: AppEmptyState(
            isSchoolDay ? 'No periods scheduled' : 'No school today',
            hint: isSchoolDay ? null : 'Enjoy the day off.',
            icon: Icons.weekend_outlined,
          ),
        ),
      );
    }
    final sorted = [...periods]
      ..sort((a, b) => a.startMinute.compareTo(b.startMinute));
    final start = sorted.indexWhere((p) => !p.isOver(now));
    if (start < 0) {
      return AppElevatedCard(
        child: Center(
          child: AppEmptyState(
            'Classes are over for today',
            hint: '${sorted.length} periods completed.',
            icon: Icons.task_alt_rounded,
          ),
        ),
      );
    }
    final shown = sorted.skip(start).take(3).toList();
    final rows = <Widget>[];
    for (var i = 0; i < shown.length; i++) {
      final p = shown[i];
      final number = sorted.indexOf(p) + 1;
      if (i == 0) {
        rows.add(_HeroPeriod(period: p, number: number, live: p.isNow(now)));
      } else {
        final prev = shown[i - 1];
        if (p.startMinute - prev.endMinute >= 15) {
          rows.add(
            _BreakRow(
              label: p.startMinute - prev.endMinute >= 30
                  ? 'Lunch & Free Recreation Break'
                  : 'Short Break',
              time: '${fmtTime(prev.endMinute)} - ${fmtTime(p.startMinute)}',
            ),
          );
        }
        rows.add(_PeriodRow(period: p, number: number));
      }
      rows.add(SizedBox(height: 10.h));
    }
    return Column(children: rows);
  }
}

class _HeroPeriod extends StatelessWidget {
  const _HeroPeriod({
    required this.period,
    required this.number,
    required this.live,
  });
  final Period period;
  final int number;
  final bool live;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: C.bg,
      borderRadius: BorderRadius.circular(R.lg),
      border: Border.all(color: C.cardBorder),
      boxShadow: const [
        BoxShadow(color: C.cardShadow, blurRadius: 12, offset: Offset(0, 2)),
      ],
    ),
    clipBehavior: Clip.antiAlias,
    child: IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(width: 4.w, color: C.primary),
          Expanded(
            child: Padding(
              padding: EdgeInsets.all(14.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 8.w,
                          vertical: 3.h,
                        ),
                        decoration: BoxDecoration(
                          color: live ? C.primary : C.indigoSoft,
                          borderRadius: BorderRadius.circular(R.sm),
                        ),
                        child: Text(
                          live ? 'IN PROGRESS' : 'UP NEXT',
                          style: T.smallStrong.copyWith(
                            color: live ? Colors.white : C.primary,
                            fontSize: 10.sp,
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      Expanded(
                        child: Text(
                          'Period $number • ${HomeSchedule._range(period)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.small,
                        ),
                      ),
                      Pill(period.room, tone: Tone.neutral),
                    ],
                  ),
                  SizedBox(height: 8.h),
                  Text(period.subject, style: T.h2.copyWith(color: C.ink)),
                  Text(
                    'Instructor: ${period.teacher}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.small,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _PeriodRow extends StatelessWidget {
  const _PeriodRow({required this.period, required this.number});
  final Period period;
  final int number;

  @override
  Widget build(BuildContext context) => AppElevatedCard(
    padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                period.subject,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.bodyStrong.copyWith(color: C.ink),
              ),
            ),
            Pill(period.room, tone: Tone.neutral),
          ],
        ),
        Text(
          'Period $number • ${HomeSchedule._range(period)} • ${period.teacher}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: T.small.copyWith(color: C.muted),
        ),
      ],
    ),
  );
}

class _BreakRow extends StatelessWidget {
  const _BreakRow({required this.label, required this.time});
  final String label, time;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 10.h),
    child: Container(
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: C.surfaceLow,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Row(
        children: [
          Icon(Icons.restaurant_outlined, size: 16.r, color: C.slate),
          SizedBox(width: 10.w),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: T.smallStrong.copyWith(color: C.onSurfaceVariant),
            ),
          ),
          Text(time, style: T.small.copyWith(color: C.muted)),
        ],
      ),
    ),
  );
}
