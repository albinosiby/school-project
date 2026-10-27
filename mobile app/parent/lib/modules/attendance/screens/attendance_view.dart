import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../academics/screens/widgets/academic_section_title.dart';
import '../bloc/attendance_bloc.dart';
import '../models/attendance_models.dart';

Tone attendanceTone(AttendanceStatus s) => switch (s) {
  AttendanceStatus.present => Tone.success,
  AttendanceStatus.absent => Tone.danger,
  AttendanceStatus.late => Tone.warning,
  AttendanceStatus.halfDay => Tone.purple,
  AttendanceStatus.leave => Tone.brand,
  AttendanceStatus.holiday => Tone.neutral,
};

/// "On Track" / "Watch" / "At Risk" label for a term percentage.
(String, Tone) attendanceStanding(double pct) => pct >= 90
    ? ('On Track', Tone.success)
    : (pct >= 75 ? ('Watch', Tone.warning) : ('At Risk', Tone.danger));

/// Attendance section of the Academics tab: term summary, month calendar and the absence log.
class AttendanceView extends StatelessWidget {
  const AttendanceView({super.key});

  @override
  Widget build(BuildContext context) =>
      ChildDataView<AttendanceBloc, AttendanceData>(
        create: () => getIt<AttendanceBloc>(),
        isEmpty: (d) => d.records.isEmpty,
        emptyTitle: 'No attendance yet',
        emptyHint: 'Daily attendance will show here once classes start.',
        emptyIcon: Icons.event_available_outlined,
        builder: (context, data, child) =>
            _AttendanceBody(key: ValueKey(child.id), data: data),
      );
}

class _AttendanceBody extends StatefulWidget {
  const _AttendanceBody({super.key, required this.data});
  final AttendanceData data;

  @override
  State<_AttendanceBody> createState() => _AttendanceBodyState();
}

class _AttendanceBodyState extends State<_AttendanceBody> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime? _picked;

  DateTime get _first =>
      DateTime(widget.data.firstMonth.year, widget.data.firstMonth.month);
  DateTime get _last => DateTime(DateTime.now().year, DateTime.now().month);
  bool get _canPrev => _month.isAfter(_first);
  bool get _canNext => _month.isBefore(_last);

  void _go(int delta) => setState(() {
    _month = DateTime(_month.year, _month.month + delta);
    _picked = null;
  });

  @override
  Widget build(BuildContext context) {
    final overall = widget.data.overall;
    final month = widget.data.summaryFor(_month);
    final absences = widget.data.absences;
    final (standing, standingTone) = attendanceStanding(overall.percentage);
    final attended = overall.present + overall.late + overall.halfDay;
    return ListView(
      key: const Key('section-list'),
      padding: academicListPadding(),
      children: [
        AppSurfaceCard(
          hero: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppEyebrow(
                          'Attendance status',
                          color: C.success,
                          leadingDot: true,
                        ),
                        SizedBox(height: 8.h),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 8.w,
                          children: [
                            Text(
                              '${overall.percentage.toStringAsFixed(1)}%',
                              key: const Key('overall-percent'),
                              style: T.title.copyWith(
                                fontSize: 28.sp,
                                color: C.onSurface,
                              ),
                            ),
                            Pill(standing, tone: standingTone),
                          ],
                        ),
                        SizedBox(height: 2.h),
                        Text(
                          '$attended of ${overall.workingDays} school days attended',
                          style: T.small.copyWith(color: C.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const IconTile(Icons.event_available_rounded, size: 48),
                ],
              ),
              SizedBox(height: 14.h),
              AppProgress(
                overall.percentage / 100,
                tone: standingTone == Tone.success ? Tone.brand : standingTone,
              ),
              SizedBox(height: 14.h),
              const Divider(height: 1, color: C.outline),
              SizedBox(height: 12.h),
              IntrinsicHeight(
                child: Row(
                  children: [
                    _Column(label: 'Present', value: '${overall.present}'),
                    const VerticalDivider(color: C.outline, width: 1),
                    _Column(
                      label: 'Absent',
                      value: '${overall.absent + overall.leave}',
                      color: C.danger,
                    ),
                    const VerticalDivider(color: C.outline, width: 1),
                    _Column(
                      label: 'School days',
                      value: '${overall.workingDays}',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        Row(
          children: [
            Expanded(
              child: AppMetricBox(
                icon: Icons.schedule_rounded,
                value: '${overall.late}',
                label: 'Late arrivals',
                tone: Tone.warning,
              ),
            ),
            SizedBox(width: 8.w),
            Expanded(
              child: AppMetricBox(
                icon: Icons.timelapse_rounded,
                value: '${overall.halfDay}',
                label: 'Half days',
                tone: Tone.purple,
              ),
            ),
            SizedBox(width: 8.w),
            Expanded(
              child: AppMetricBox(
                icon: Icons.beach_access_outlined,
                value: '${overall.leave}',
                label: 'On leave',
              ),
            ),
          ],
        ),
        const AcademicSectionTitle(
          'Monthly calendar',
          icon: Icons.calendar_month_rounded,
        ),
        AppSurfaceCard(
          padding: EdgeInsets.fromLTRB(8.w, 8.h, 8.w, 14.h),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Previous month',
                    onPressed: _canPrev ? () => _go(-1) : null,
                    icon: const Icon(Icons.chevron_left_rounded),
                  ),
                  Expanded(
                    child: Text(
                      fmtMonth(_month),
                      key: const Key('month-title'),
                      textAlign: TextAlign.center,
                      style: T.h3.copyWith(color: C.onSurface),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next month',
                    onPressed: _canNext ? () => _go(1) : null,
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 6.w),
                child: _CalendarGrid(
                  month: _month,
                  data: widget.data,
                  picked: _picked,
                  onPick: (d) => setState(() => _picked = d),
                ),
              ),
              SizedBox(height: 10.h),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 8.w),
                child: _DayDetail(day: _picked, data: widget.data),
              ),
              SizedBox(height: 10.h),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 8.w),
                child: Wrap(
                  spacing: 10.w,
                  runSpacing: 6.h,
                  children: [
                    for (final s in AttendanceStatus.values)
                      _LegendDot(status: s),
                  ],
                ),
              ),
              SizedBox(height: 10.h),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 8.w),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    month.workingDays == 0
                        ? 'No school days recorded this month.'
                        : 'This month: ${month.percentage.toStringAsFixed(0)}% · ${month.present} present, ${month.absent + month.leave} absent, ${month.late} late',
                    key: const Key('month-summary'),
                    style: T.small.copyWith(color: C.onSurfaceVariant),
                  ),
                ),
              ),
            ],
          ),
        ),
        AcademicSectionTitle(
          'Absence log',
          icon: Icons.event_busy_outlined,
          action: 'Apply leave',
          onAction: () => context.push(RoutePaths.leaveApply),
        ),
        if (absences.isEmpty)
          AppSurfaceCard(
            child: Center(
              child: AppEmptyState(
                'No absences',
                hint: 'Full attendance so far this term.',
                icon: Icons.verified_outlined,
              ),
            ),
          )
        else
          for (final r in absences)
            AppEntryCard(
              icon: r.status == AttendanceStatus.leave
                  ? Icons.beach_access_outlined
                  : Icons.event_busy_outlined,
              tone: attendanceTone(r.status),
              title: fmtDate(r.date, year: true),
              meta: r.status == AttendanceStatus.leave
                  ? 'Approved leave'
                  : 'Marked by class teacher',
              trailing: Pill(r.status.label, tone: attendanceTone(r.status)),
              body: r.note,
            ),
        academicListEnd(),
      ],
    );
  }
}

class _Column extends StatelessWidget {
  const _Column({required this.label, required this.value, this.color});
  final String label, value;
  final Color? color;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          label,
          style: T.small.copyWith(fontSize: 12.sp, color: C.onSurfaceVariant),
        ),
        SizedBox(height: 2.h),
        Text.rich(
          TextSpan(
            text: value,
            style: T.h2.copyWith(color: color ?? C.onSurface),
            children: [
              TextSpan(
                text: ' days',
                style: T.small.copyWith(color: C.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _DayDetail extends StatelessWidget {
  const _DayDetail({required this.day, required this.data});
  final DateTime? day;
  final AttendanceData data;

  @override
  Widget build(BuildContext context) {
    final d = day;
    if (d == null) {
      return Text(
        'Tap a date to see its status.',
        style: T.small.copyWith(color: C.muted),
      );
    }
    final r = data.on(d);
    final weekend = d.weekday > DateTime.friday;
    final label =
        r?.status.label ??
        (weekend
            ? 'Weekend'
            : (d.isAfter(DateTime.now()) ? 'Upcoming' : 'No record'));
    return Container(
      key: const Key('day-detail'),
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
      decoration: BoxDecoration(
        color: C.surfaceLow,
        borderRadius: BorderRadius.circular(R.sm),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(fmtDate(d, year: true), style: T.smallStrong),
                if (r?.note != null)
                  Text(
                    r!.note!,
                    style: T.small.copyWith(color: C.onSurfaceVariant),
                  ),
              ],
            ),
          ),
          Pill(
            label,
            tone: r == null ? Tone.neutral : attendanceTone(r.status),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.status});
  final AttendanceStatus status;

  @override
  Widget build(BuildContext context) {
    final c = toneColors(attendanceTone(status));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9.r,
          height: 9.r,
          decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle),
        ),
        SizedBox(width: 4.w),
        Text(
          status.label,
          style: T.small.copyWith(fontSize: 11.sp, color: C.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({
    required this.month,
    required this.data,
    required this.picked,
    required this.onPick,
  });
  final DateTime month;
  final AttendanceData data;
  final DateTime? picked;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final lead =
        DateTime(month.year, month.month, 1).weekday - 1; // Monday first
    final cells = <Widget>[
      for (final d in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
        Center(child: Text(d, style: T.capsMuted)),
      for (var i = 0; i < lead; i++) const SizedBox.shrink(),
      for (var day = 1; day <= daysInMonth; day++)
        _DayCell(
          date: DateTime(month.year, month.month, day),
          record: data.on(DateTime(month.year, month.month, day)),
          selected:
              picked != null &&
              sameDay(picked!, DateTime(month.year, month.month, day)),
          onTap: () => onPick(DateTime(month.year, month.month, day)),
        ),
    ];
    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 4.h,
      crossAxisSpacing: 4.w,
      children: cells,
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.record,
    required this.selected,
    required this.onTap,
  });
  final DateTime date;
  final AttendanceRecord? record;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isToday = sameDay(date, DateTime.now());
    final weekend = date.weekday > DateTime.friday;
    final colors = record == null
        ? null
        : toneColors(attendanceTone(record!.status));
    return Semantics(
      button: true,
      label:
          '${fmtDate(date)}: ${record?.status.label ?? (weekend ? 'weekend' : 'no record')}',
      child: InkWell(
        key: Key('day-${date.day}'),
        borderRadius: BorderRadius.circular(R.sm),
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? C.primary : (colors?.bg ?? Colors.transparent),
            borderRadius: BorderRadius.circular(R.sm),
            border: isToday && !selected
                ? Border.all(color: C.primary, width: 1.5)
                : null,
          ),
          child: Text(
            '${date.day}',
            style: T.smallStrong.copyWith(
              color: selected
                  ? Colors.white
                  : colors?.fg ?? (weekend ? C.muted : C.slate),
              fontWeight: record == null ? FontWeight.w500 : FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
