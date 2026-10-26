import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/timetable_bloc.dart';
import '../bloc/timetable_events.dart';
import '../bloc/timetable_states.dart';
import '../models/timetable_models.dart';
import 'widgets/teacher_tab_header.dart';
import 'widgets/weekly_grid_view.dart';

/// Timetable tab (Figma 1153:20957 daily view; 1153:13882 weekly grid segment).
class TimetableScreen extends StatelessWidget {
  const TimetableScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<TimetableBloc>()..add(const TimetableLoadRequested()),
        child: const _TimetableView(),
      );
}

class _TimetableView extends StatefulWidget {
  const _TimetableView();
  @override
  State<_TimetableView> createState() => _TimetableViewState();
}

class _TimetableViewState extends State<_TimetableView> {
  Timer? _tick;
  late SchoolNow _now = schoolNow();
  late int _day = _now.day;
  late DateTime _monday = _now.monday;
  bool _weekly = false;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = schoolNow());
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  DateTime get _date => _monday.add(Duration(days: _day - 1));
  bool get _isToday => _date.year == _now.at.year && _date.month == _now.at.month && _date.day == _now.at.day;

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2024), lastDate: DateTime(2030));
    if (d == null || !mounted) return;
    if (d.weekday == 7) {
      AppDialogs.showSnackBar(context, message: 'No classes on Sunday');
      return;
    }
    setState(() {
      _monday = mondayOf(d);
      _day = d.weekday;
    });
  }

  Future<void> _sync() async {
    final bloc = context.read<TimetableBloc>()..add(const TimetableSyncRequested());
    await bloc.stream.firstWhere((s) => !s.syncing);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TimetableBloc>().state;
    final name = context.select<SchoolBloc, String?>((b) => b.state.teacher?.name);
    final dateLabel = _weekly
        ? '${dayMonth(_monday)} – ${dayMonth(_monday.add(const Duration(days: 5)))} ${_monday.year}'
        : _isToday
            ? 'Today, ${dayMonth(_date)}'
            : '${kDayShort[_day - 1]}, ${dayMonth(_date)}';
    final dayPeriods = state.periodsOf(_day);
    return BlocListener<TimetableBloc, TimetableState>(
      listenWhen: (a, b) => b.syncCount > a.syncCount,
      listener: (context, _) => AppDialogs.showSnackBar(context, message: 'Calendar synced'),
      child: Column(children: [
        TeacherTabHeader(title: 'Timetable', subtitle: name),
        Expanded(
          // main column, then `side:` (the second column on wide screens)
          // ignore: sort_child_properties_last
          child: AppTabBody(onRefresh: _sync, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(flex: 2, child: Pill('Term 2 • Week ${termWeek(_date)}', tone: Tone.brand, dot: true)),
              SizedBox(width: 8.w),
              Flexible(
                flex: 3,
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: Icon(Icons.calendar_today_outlined, size: 16.r, color: C.primary),
                  label: Row(mainAxisSize: MainAxisSize.min, children: [
                    Flexible(child: Text(dateLabel, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Icon(Icons.keyboard_arrow_down_rounded, size: 18.r, color: C.slate),
                  ]),
                  style: OutlinedButton.styleFrom(
                    minimumSize: Size(0, 44.h), padding: EdgeInsets.symmetric(horizontal: 12.w), side: const BorderSide(color: C.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
                  ),
                ),
              ),
            ]),
            SizedBox(height: 14.h),
            AppSegmented(items: const ['Daily View', 'Weekly Grid'], value: _weekly ? 'Weekly Grid' : 'Daily View', track: true, onChanged: (v) => setState(() => _weekly = v == 'Weekly Grid')),
            SizedBox(height: 14.h),
            if (_weekly)
              WeeklyGridView(key: ValueKey(_monday), now: _now, weekStart: _monday)
            else ...[
              _DayStrip(state: state, monday: _monday, day: _day, onPick: (d) => setState(() => _day = d)),
              SizedBox(height: 16.h),
              if (state.noticeFor(_day) case final sub?) _SubNotice(sub),
              if (_isToday) _LiveCard(now: _now, today: state.periodsOf(_now.day)),
            ],
          ], side: [
            if (!_weekly) ...[
              SizedBox(height: 4.h),
              Row(children: [
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(top: 12.h, bottom: 10.h),
                    child: Text.rich(
                      TextSpan(children: [TextSpan(text: 'Schedule Timeline ', style: T.h2), TextSpan(text: '(${dayPeriods.length} Periods • 2 Breaks)', style: T.small)]),
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: state.syncing ? null : () => context.read<TimetableBloc>().add(const TimetableSyncRequested()),
                  iconAlignment: IconAlignment.end,
                  icon: Icon(Icons.sync_rounded, size: 16.r, color: C.primary),
                  label: Text(state.syncing ? 'Syncing…' : 'Sync Calendar', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
                ),
              ]),
              _Timeline(periods: dayPeriods, now: _now, day: _isToday ? _now.day : (_date.isBefore(_now.at) ? 0 : 7)),
              SizedBox(height: 4.h),
              Center(
                child: TextButton.icon(
                  onPressed: () => context.push(RoutePaths.weeklyGrid),
                  icon: Icon(Icons.grid_view_rounded, size: 18.r),
                  label: const Text('Open full weekly grid'),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _DayStrip extends StatelessWidget {
  const _DayStrip({required this.state, required this.monday, required this.day, required this.onPick});
  final TimetableState state;
  final DateTime monday;
  final int day;
  final ValueChanged<int> onPick;
  @override
  Widget build(BuildContext context) => Row(children: [
        for (var d = 1; d <= 6; d++)
          Expanded(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 3.w),
              child: Semantics(
                button: true, selected: d == day, label: '${kDayLong[d - 1]} ${monday.add(Duration(days: d - 1)).day}',
                child: GestureDetector(
                  onTap: () => onPick(d),
                  child: Container(
                    height: 74.h,
                    decoration: BoxDecoration(
                      color: d == day ? C.primarySoft : C.bg, borderRadius: BorderRadius.circular(R.lg),
                      border: Border.all(color: d == day ? C.primary.withValues(alpha: .5) : C.border, width: d == day ? 2 : 1),
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(kDayShort[d - 1].toUpperCase(), style: T.small.copyWith(fontSize: 11.sp, fontWeight: FontWeight.w700, color: d == day ? C.primary : C.slate)),
                      FittedBox(child: Text('${monday.add(Duration(days: d - 1)).day}', style: T.h2.copyWith(color: d == day ? C.primary : C.ink))),
                      SizedBox(height: 2.h),
                      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        for (var i = 0; i < state.periodsOf(d).where((p) => p.kind != PeriodKind.prep).length.clamp(0, 3); i++)
                          Container(
                            width: 4.r, height: 4.r, margin: EdgeInsets.symmetric(horizontal: 1.w),
                            decoration: BoxDecoration(color: d == day ? C.primary : C.muted, shape: BoxShape.circle),
                          ),
                      ]),
                    ]),
                  ),
                ),
              ),
            ),
          ),
      ]);
}

class _SubNotice extends StatelessWidget {
  const _SubNotice(this.sub);
  final Substitution sub;
  @override
  Widget build(BuildContext context) {
    final accepted = sub.status == SubStatus.accepted;
    final slot = slotOf(sub.slot);
    return Container(
      margin: EdgeInsets.only(bottom: 14.h), padding: EdgeInsets.all(14.r),
      decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: C.panelBorder)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const IconTile(Icons.swap_horiz_rounded, size: 40), SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(accepted ? 'NOTICE • SUBSTITUTION ACCEPTED' : 'NOTICE • SUBSTITUTION ASSIGNED', style: T.caps.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                SizedBox(width: 6.w),
                Text(sub.posted, style: T.small.copyWith(fontSize: 11.sp)),
              ]),
              SizedBox(height: 4.h),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: 'Assigned to cover ', style: T.body.copyWith(fontSize: 13.sp, color: C.ink)),
                  TextSpan(text: 'Period ${slot.id.substring(1)} (Class ${sub.classLabel})', style: T.body.copyWith(fontSize: 13.sp, color: C.primary)),
                  TextSpan(text: sub.faculty.isEmpty ? '.' : ' for ${sub.faculty}.', style: T.body.copyWith(fontSize: 13.sp, color: C.ink)),
                ]),
              ),
            ]),
          ),
        ]),
        Divider(height: 22.h),
        InkWell(
          onTap: () => context.push(RoutePaths.substitution(sub.id)),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 8.h),
            child: Text('View Substitution Brief & Lesson Notes  →', style: T.bodyStrong.copyWith(color: C.primary, fontSize: 13.sp)),
          ),
        ),
      ]),
    );
  }
}

class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.now, required this.today});
  final SchoolNow now;
  final List<Period> today;
  @override
  Widget build(BuildContext context) {
    final live = nowInfo(today, now).live;
    if (live == null) return const SizedBox.shrink();
    final slot = slotOf(live.slot);
    final school = context.watch<SchoolBloc>().state;
    final cls = live.classId == null ? null : school.classById(live.classId!);
    final done = (now.minute - slot.startMin).clamp(0, slot.length);
    final subject = (cls?.subject ?? live.subject).replaceAll('Advanced ', '');
    return PanelCard(
      margin: EdgeInsets.only(bottom: 14.h),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(child: Text('● NOW HAPPENING • PERIOD ${live.no}', style: T.caps.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          SizedBox(width: 8.w),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.panelBorder)),
            child: Text('${slot.length - done} mins remaining', style: T.smallStrong.copyWith(color: C.primary, fontSize: 11.sp)),
          ),
        ]),
        SizedBox(height: 12.h),
        Text(subject, style: T.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        SizedBox(height: 6.h),
        Row(children: [
          Icon(Icons.school_outlined, size: 15.r, color: C.ink), SizedBox(width: 6.w),
          Flexible(
            child: Text.rich(
              TextSpan(children: [TextSpan(text: 'Class ${live.label} ', style: T.bodyStrong), TextSpan(text: '(${cls?.students ?? '-'} Students)', style: T.small)]),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
        ]),
        SizedBox(height: 4.h),
        Wrap(spacing: 14.w, runSpacing: 4.h, children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.place_outlined, size: 14.r, color: C.slate), SizedBox(width: 4.w),
            Text('${live.room}${cls != null && cls.wing.isNotEmpty ? ' (${cls.wing})' : ''}', style: T.small),
          ]),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.schedule_rounded, size: 14.r, color: C.slate), SizedBox(width: 4.w),
            Text('${t12(slot.start)} – ${t12(slot.end)}', style: T.small),
          ]),
        ]),
        SizedBox(height: 14.h),
        AppProgress(done / slot.length),
        SizedBox(height: 14.h),
        Row(children: [
          Expanded(child: AppButton('Mark Attendance', icon: Icons.how_to_reg_outlined, small: true, onPressed: () => context.push(RoutePaths.attendanceMark))),
          SizedBox(width: 10.w),
          Expanded(child: AppButton('Lesson Plan', icon: Icons.menu_book_outlined, small: true, kind: BtnKind.outline, onPressed: () => context.push(RoutePaths.lessonPlans))),
        ]),
      ]),
    );
  }
}

class _Timeline extends StatelessWidget {
  /// [day] is the weekday used for status: the real day when it is today, 0 (all done) for past dates, 7 (all upcoming) for future dates.
  const _Timeline({required this.periods, required this.now, required this.day});
  final List<Period> periods;
  final SchoolNow now;
  final int day;

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final bySlot = {for (final p in periods) p.slot: p};
    final rows = <Widget>[];
    for (final sl in kSlots) {
      if (sl.isBreak) {
        rows.add(Container(
          margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.all(12.r),
          decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Icon(Icons.local_cafe_outlined, size: 18.r, color: C.warningDark), SizedBox(width: 8.w),
            Expanded(child: Text('${sl.label} • ${t12(sl.start)} – ${t12(sl.end)} (${sl.length} mins)', style: T.small.copyWith(color: C.warningDark, fontWeight: FontWeight.w600))),
          ]),
        ));
        continue;
      }
      final p = bySlot[sl.id];
      if (p == null) continue;
      final st = statusOf(sl, day, now);
      final cls = p.classId == null ? null : school.classById(p.classId!);
      final (label, tone) = p.kind == PeriodKind.sub
          ? ('Sub Duty', Tone.warning)
          : switch (st) { PStatus.done => ('Done', Tone.success), PStatus.live => ('Now', Tone.brand), PStatus.upcoming => ('Upcoming', Tone.neutral) };
      final att = st == PStatus.done && cls != null && p.kind != PeriodKind.sub ? ' • Attendance: ${attendedCount(p, cls.students)}/${cls.students}' : '';
      final live = st == PStatus.live;
      rows.add(Padding(
        padding: EdgeInsets.only(bottom: 10.h),
        child: AppCard(
          radius: R.lg, padding: EdgeInsets.all(14.r),
          color: live ? C.primarySoft : C.bg, border: live ? C.primary.withValues(alpha: .4) : C.border,
          onTap: p.kind == PeriodKind.sub && p.subId != null ? () => context.push(RoutePaths.substitution(p.subId!)) : null,
          child: Row(children: [
            SizedBox(
              width: 52.w,
              child: Column(children: [Text('P-${p.no}', style: T.h3), Text(t12(sl.start), textAlign: TextAlign.center, style: T.small.copyWith(fontSize: 10.5.sp))]),
            ),
            Container(
              width: 3.w, height: 44.h, margin: EdgeInsets.symmetric(horizontal: 10.w),
              decoration: BoxDecoration(color: kindColors(p.kind).fg.withValues(alpha: .35), borderRadius: BorderRadius.circular(2.r)),
            ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(p.subject, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  SizedBox(width: 6.w),
                  Pill(label, tone: tone, icon: st == PStatus.done && p.kind != PeriodKind.sub ? Icons.check_circle_outline_rounded : null),
                ]),
                SizedBox(height: 2.h),
                Text(p.kind == PeriodKind.prep ? p.room : 'Class ${p.label} • ${p.room}$att', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ]),
        ),
      ));
    }
    return Column(children: rows);
  }
}
