import 'package:flutter/material.dart';
import '../../../core/widgets/child_data_view.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/helpers/date_helper.dart';
import '../../family/screens/widgets/parent_tab_header.dart';
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

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const ParentTabHeader(title: 'Attendance'),
      Expanded(
        child: ChildDataView<AttendanceBloc, AttendanceData>(
          create: () => getIt<AttendanceBloc>(),
          isEmpty: (d) => d.records.isEmpty,
          emptyTitle: 'No attendance yet',
          emptyHint: 'Daily attendance will show here once classes start.',
          emptyIcon: Icons.event_available_outlined,
          builder: (context, data, child) =>
              _AttendanceBody(key: ValueKey(child.id), data: data),
        ),
      ),
    ],
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

  DateTime get _first =>
      DateTime(widget.data.firstMonth.year, widget.data.firstMonth.month);
  DateTime get _last => DateTime(DateTime.now().year, DateTime.now().month);
  bool get _canPrev => _month.isAfter(_first);
  bool get _canNext => _month.isBefore(_last);

  void _go(int delta) =>
      setState(() => _month = DateTime(_month.year, _month.month + delta));

  @override
  Widget build(BuildContext context) {
    final overall = widget.data.overall;
    final month = widget.data.summaryFor(_month);
    final absences = widget.data.absences;
    return AppTabBody(
      children: [
        PanelCard(
          child: Row(
            children: [
              AppStatRing(
                value: overall.percentage / 100,
                label: '${overall.percentage.toStringAsFixed(0)}%',
                size: 76,
                stroke: 7,
                color: overall.percentage >= 90
                    ? C.success
                    : (overall.percentage >= 75 ? C.warning : C.danger),
              ),
              SizedBox(width: 16.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('TERM ATTENDANCE', style: T.caps),
                    SizedBox(height: 2.h),
                    Text(
                      '${overall.percentage.toStringAsFixed(1)}%',
                      key: const Key('overall-percent'),
                      style: T.stat,
                    ),
                    Text(
                      '${overall.present + overall.late + overall.halfDay} of ${overall.workingDays} school days attended',
                      style: T.small,
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
              child: StatTile(
                label: 'Present',
                value: '${overall.present}',
                icon: Icons.check_circle_outline_rounded,
                tone: Tone.success,
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: StatTile(
                label: 'Absent',
                value: '${overall.absent + overall.leave}',
                icon: Icons.cancel_outlined,
                tone: Tone.danger,
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: StatTile(
                label: 'Late',
                value: '${overall.late}',
                icon: Icons.schedule_rounded,
                tone: Tone.warning,
              ),
            ),
          ],
        ),
        SectionHeader('Calendar', icon: Icons.calendar_month_rounded),
        AppCard(
          padding: EdgeInsets.all(12.w),
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
                      style: T.h3,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next month',
                    onPressed: _canNext ? () => _go(1) : null,
                    icon: const Icon(Icons.chevron_right_rounded),
                  ),
                ],
              ),
              SizedBox(height: 6.h),
              _CalendarGrid(month: _month, data: widget.data),
              SizedBox(height: 12.h),
              Wrap(
                spacing: 10.w,
                runSpacing: 6.h,
                children: [
                  for (final s in AttendanceStatus.values)
                    _LegendDot(status: s),
                ],
              ),
              SizedBox(height: 10.h),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  month.workingDays == 0
                      ? 'No school days recorded this month.'
                      : 'This month: ${month.percentage.toStringAsFixed(0)}% - ${month.present} present, ${month.absent + month.leave} absent, ${month.late} late',
                  style: T.small,
                ),
              ),
            ],
          ),
        ),
        SectionHeader('Absences', icon: Icons.event_busy_outlined),
        if (absences.isEmpty)
          AppCard(
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
            Padding(
              padding: EdgeInsets.only(bottom: 10.h),
              child: AppCard(
                padding: EdgeInsets.all(12.w),
                child: Row(
                  children: [
                    IconTile(
                      r.status == AttendanceStatus.leave
                          ? Icons.beach_access_outlined
                          : Icons.event_busy_outlined,
                      tone: attendanceTone(r.status),
                      size: 38,
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fmtDate(r.date, year: true),
                            style: T.bodyStrong,
                          ),
                          if (r.note != null) Text(r.note!, style: T.small),
                        ],
                      ),
                    ),
                    Pill(r.status.label, tone: attendanceTone(r.status)),
                  ],
                ),
              ),
            ),
      ],
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
          width: 10.r,
          height: 10.r,
          decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle),
        ),
        SizedBox(width: 4.w),
        Text(status.label, style: T.small.copyWith(fontSize: 11.sp)),
      ],
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({required this.month, required this.data});
  final DateTime month;
  final AttendanceData data;

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
  const _DayCell({required this.date, required this.record});
  final DateTime date;
  final AttendanceRecord? record;

  @override
  Widget build(BuildContext context) {
    final isToday = sameDay(date, DateTime.now());
    final weekend = date.weekday > DateTime.friday;
    final colors = record == null
        ? null
        : toneColors(attendanceTone(record!.status));
    return Semantics(
      label:
          '${fmtDate(date)}: ${record?.status.label ?? (weekend ? 'weekend' : 'no record')}',
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors?.bg ?? Colors.transparent,
          borderRadius: BorderRadius.circular(R.sm),
          border: isToday ? Border.all(color: C.primary, width: 1.5) : null,
        ),
        child: Text(
          '${date.day}',
          style: T.smallStrong.copyWith(
            color: colors?.fg ?? (weekend ? C.muted : C.slate),
            fontWeight: record == null ? FontWeight.w500 : FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
