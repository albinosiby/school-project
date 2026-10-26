import 'package:flutter/material.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../bloc/timetable_bloc.dart';
import '../models/timetable_models.dart';

const _dayNames = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

/// Weekly timetable: day chips + the periods of the chosen day.
class TimetableView extends StatelessWidget {
  const TimetableView({super.key});

  @override
  Widget build(BuildContext context) =>
      ChildDataView<TimetableBloc, TimetableWeek>(
        create: () => getIt<TimetableBloc>(),
        isEmpty: (d) => d.periods.isEmpty,
        emptyTitle: 'No timetable yet',
        emptyHint: 'The class timetable will appear here once it is published.',
        emptyIcon: Icons.calendar_today_outlined,
        builder: (context, week, child) => _TimetableBody(week: week),
      );
}

class _TimetableBody extends StatefulWidget {
  const _TimetableBody({required this.week});
  final TimetableWeek week;

  @override
  State<_TimetableBody> createState() => _TimetableBodyState();
}

class _TimetableBodyState extends State<_TimetableBody> {
  late int _day = widget.week.days.contains(DateTime.now().weekday)
      ? DateTime.now().weekday
      : widget.week.days.first;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final periods = widget.week.forDay(_day);
    final days = [for (final d in widget.week.days) _dayNames[d]!];
    return AppTabBody(
      children: [
        FilterChips(
          items: days,
          value: _dayNames[_day]!,
          onChanged: (v) => setState(
            () => _day = _dayNames.entries.firstWhere((e) => e.value == v).key,
          ),
        ),
        SizedBox(height: 14.h),
        if (periods.isEmpty)
          AppEmptyState(
            'No periods',
            hint: 'Nothing is scheduled for this day.',
            icon: Icons.event_busy_outlined,
          )
        else
          for (final p in periods) _PeriodCard(period: p, now: now),
      ],
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.period, required this.now});
  final Period period;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final current = period.isNow(now);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        color: current ? C.primarySoft : C.bg,
        border: current ? C.primary.withValues(alpha: .4) : C.border,
        padding: EdgeInsets.all(12.w),
        child: Row(
          children: [
            SizedBox(
              width: 72.w,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(fmtMinute(period.startMinute), style: T.smallStrong),
                  Text(fmtMinute(period.endMinute), style: T.small),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(period.subject, style: T.h3),
                  Text(period.teacher, style: T.small),
                ],
              ),
            ),
            AppTagChip(
              period.room,
              icon: Icons.meeting_room_outlined,
              neutral: true,
            ),
          ],
        ),
      ),
    );
  }
}
