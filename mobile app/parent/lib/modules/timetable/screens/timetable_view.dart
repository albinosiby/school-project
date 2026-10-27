import 'package:flutter/material.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
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

const _dayLong = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/// Timetable section of the Academics tab: this week's day strip, the chosen day's periods and the
/// weekly subject load.
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
        builder: (context, week, child) =>
            _TimetableBody(key: ValueKey(child.id), week: week),
      );
}

class _TimetableBody extends StatefulWidget {
  const _TimetableBody({super.key, required this.week});
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
    final monday = dateOnly(now).subtract(Duration(days: now.weekday - 1));
    final periods = widget.week.forDay(_day);
    final load = <String, int>{};
    for (final p in widget.week.periods) {
      load[p.subject] = (load[p.subject] ?? 0) + 1;
    }
    final subjects = load.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final isToday = _day == now.weekday;
    return ListView(
      key: const Key('section-list'),
      padding: academicListPadding(),
      children: [
        Row(
          children: [
            for (final d in widget.week.days) ...[
              if (d != widget.week.days.first) SizedBox(width: 6.w),
              Expanded(
                child: _DayTile(
                  day: d,
                  date: monday.add(Duration(days: d - 1)),
                  count: widget.week.forDay(d).length,
                  selected: d == _day,
                  today: d == now.weekday,
                  onTap: () => setState(() => _day = d),
                ),
              ),
            ],
          ],
        ),
        SizedBox(height: 12.h),
        AppSurfaceCard(
          hero: true,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppEyebrow(isToday ? "Today's schedule" : 'Schedule'),
                    SizedBox(height: 6.h),
                    Text(
                      _dayLong[_day]!,
                      key: const Key('timetable-day'),
                      style: T.h1.copyWith(color: C.onSurface),
                    ),
                    Text(
                      periods.isEmpty
                          ? 'No classes'
                          : '${periods.length} periods • ${fmtMinute(periods.first.startMinute)} – ${fmtMinute(periods.last.endMinute)}',
                      style: T.small.copyWith(color: C.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              const IconTile(Icons.schedule_rounded, size: 48),
            ],
          ),
        ),
        AcademicSectionTitle(
          'Periods',
          icon: Icons.view_agenda_outlined,
          caption: fmtDate(monday.add(Duration(days: _day - 1))),
        ),
        if (periods.isEmpty)
          AppSurfaceCard(
            child: AppEmptyState(
              'No periods',
              hint: 'Nothing is scheduled for this day.',
              icon: Icons.event_busy_outlined,
            ),
          )
        else
          for (var i = 0; i < periods.length; i++)
            _PeriodCard(
              index: i + 1,
              period: periods[i],
              now: now,
              isToday: isToday,
            ),
        AcademicSectionTitle(
          'Weekly load',
          icon: Icons.donut_small_outlined,
          caption: '${widget.week.periods.length} periods / week',
        ),
        AppSurfaceCard(
          child: Wrap(
            spacing: 8.w,
            runSpacing: 8.h,
            children: [
              for (final e in subjects)
                AppMetaChip(
                  '${e.key} · ${e.value}',
                  icon: Icons.auto_stories_outlined,
                ),
            ],
          ),
        ),
        academicListEnd(),
      ],
    );
  }
}

class _DayTile extends StatelessWidget {
  const _DayTile({
    required this.day,
    required this.date,
    required this.count,
    required this.selected,
    required this.today,
    required this.onTap,
  });
  final int day, count;
  final DateTime date;
  final bool selected, today;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? Colors.white : C.onSurface;
    return Semantics(
      button: true,
      selected: selected,
      label: '${_dayLong[day]}, $count periods',
      child: InkWell(
        key: Key('day-tile-$day'),
        borderRadius: BorderRadius.circular(R.md),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: EdgeInsets.symmetric(vertical: 10.h),
          decoration: BoxDecoration(
            color: selected ? C.primary : C.bg,
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(
              color: selected
                  ? C.primary
                  : (today ? C.primary.withValues(alpha: .5) : C.outline),
            ),
          ),
          child: Column(
            children: [
              Text(
                _dayNames[day]!,
                style: T.small.copyWith(
                  fontSize: 11.sp,
                  color: selected ? Colors.white70 : C.onSurfaceVariant,
                ),
              ),
              SizedBox(height: 2.h),
              Text('${date.day}', style: T.h2.copyWith(color: fg)),
              SizedBox(height: 2.h),
              Container(
                width: 5.r,
                height: 5.r,
                decoration: BoxDecoration(
                  color: today
                      ? (selected ? Colors.white : C.primary)
                      : Colors.transparent,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({
    required this.index,
    required this.period,
    required this.now,
    required this.isToday,
  });
  final int index;
  final Period period;
  final DateTime now;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final current = isToday && period.isNow(now);
    final over = isToday && period.isOver(now);
    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 62.w,
            child: Padding(
              padding: EdgeInsets.only(top: 14.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fmtMinute(period.startMinute),
                    style: T.smallStrong.copyWith(
                      color: over ? C.muted : C.onSurface,
                    ),
                  ),
                  Text(
                    fmtMinute(period.endMinute),
                    style: T.small.copyWith(fontSize: 11.sp, color: C.muted),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: AppSurfaceCard(
              color: current ? C.primarySoft : C.bg,
              borderColor: current ? C.primary.withValues(alpha: .4) : null,
              padding: EdgeInsets.all(12.w),
              child: Opacity(
                opacity: over ? .6 : 1,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PERIOD $index',
                            style: T.capsMuted.copyWith(fontSize: 10.sp),
                          ),
                          SizedBox(height: 2.h),
                          Text(
                            period.subject,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.h3.copyWith(color: C.onSurface),
                          ),
                          Text(
                            period.teacher,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.small.copyWith(color: C.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (current) ...[
                          const Pill('Now', tone: Tone.brand, dot: true),
                          SizedBox(height: 6.h),
                        ],
                        AppTagChip(
                          period.room,
                          icon: Icons.meeting_room_outlined,
                          neutral: true,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
