import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes/routes.dart';
import '../../../../design_system/design_system.dart';
import '../../bloc/timetable_bloc.dart';
import '../../models/timetable_models.dart';

({Color fg, Color bg}) kindColors(PeriodKind kind) => switch (kind) {
      PeriodKind.sub => (fg: C.warningDark, bg: C.warningSoft),
      PeriodKind.remedial => (fg: C.successDark, bg: C.successSoft),
      PeriodKind.prep => (fg: C.slate, bg: C.primarySoft),
      PeriodKind.core => (fg: C.primary, bg: C.primarySoft),
    };

/// Weekly timetable grid (Figma 1153:13882): stats, day chips, period matrix, day detail.
/// Used inline in the Timetable tab ("Weekly Grid" segment) and on the pushed weekly grid screen.
/// Needs a [TimetableBloc] above it.
class WeeklyGridView extends StatefulWidget {
  const WeeklyGridView({super.key, required this.now, this.weekStart});
  final SchoolNow now;
  final DateTime? weekStart;
  @override
  State<WeeklyGridView> createState() => _WeeklyGridViewState();
}

class _WeeklyGridViewState extends State<WeeklyGridView> {
  late int _day = widget.now.day;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TimetableBloc>().state;
    final now = widget.now;
    final monday = widget.weekStart ?? now.monday;
    final all = state.week;
    int count(PeriodKind k) => all.where((p) => p.kind == k).length;
    final dayRows = state.periodsOf(_day);
    bool isToday(int d) {
      final dt = monday.add(Duration(days: d - 1));
      return dt.year == now.at.year && dt.month == now.at.month && dt.day == now.at.day;
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: _GridStat('Teaching', '${count(PeriodKind.core)}', 'periods', C.primary)),
        SizedBox(width: 8.w),
        Expanded(child: _GridStat('Remedial', '${count(PeriodKind.remedial)}', 'labs', C.successDark)),
        SizedBox(width: 8.w),
        Expanded(child: _GridStat('Sub Duty', '${count(PeriodKind.sub)}', 'assigned', C.warningDark)),
      ]),
      SizedBox(height: 14.h),
      SizedBox(
        height: 44.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal, itemCount: 6, separatorBuilder: (_, _) => SizedBox(width: 8.w),
          itemBuilder: (_, i) {
            final d = i + 1, on = d == _day;
            final dt = monday.add(Duration(days: i));
            return Semantics(
              button: true, selected: on, label: '${kDayLong[i]} ${dt.day}',
              child: GestureDetector(
                onTap: () => setState(() => _day = d),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 16.w), alignment: Alignment.center,
                  decoration: BoxDecoration(color: on ? C.primary : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary : C.border)),
                  child: Row(children: [
                    Text('${kDayShort[i]} ${dt.day}', style: T.bodyStrong.copyWith(color: on ? Colors.white : C.ink, fontSize: 13.5.sp)),
                    if (isToday(d)) ...[
                      SizedBox(width: 6.w),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                        decoration: BoxDecoration(color: on ? Colors.white24 : C.primarySoft, borderRadius: BorderRadius.circular(6.r)),
                        child: Text('Today', style: T.small.copyWith(color: on ? Colors.white : C.primary, fontSize: 10.sp)),
                      ),
                    ],
                  ]),
                ),
              ),
            );
          },
        ),
      ),
      Padding(
        padding: EdgeInsets.only(top: 18.h, bottom: 10.h),
        child: Row(children: [
          Expanded(child: Text('Weekly Timetable Grid', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
          const Pill('6 Days', tone: Tone.brand),
          SizedBox(width: 8.w),
          AppButton('Export', icon: Icons.ios_share_rounded, kind: BtnKind.outline, small: true, expand: false,
              onPressed: () => AppDialogs.showSnackBar(context, message: 'Weekly timetable exported (simulated)')),
        ]),
      ),
      Wrap(spacing: 14.w, runSpacing: 6.h, children: [
        for (final k in [PeriodKind.core, PeriodKind.sub, PeriodKind.remedial, PeriodKind.prep])
          Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 12.r, height: 12.r,
              decoration: BoxDecoration(color: kindColors(k).bg, border: Border.all(color: kindColors(k).fg.withValues(alpha: .4)), borderRadius: BorderRadius.circular(3.r)),
            ),
            SizedBox(width: 5.w), Text(kindLabel(k), style: T.small),
          ]),
      ]),
      SizedBox(height: 12.h),
      AppCard(
        radius: R.xl, padding: EdgeInsets.fromLTRB(10.w, 14.h, 10.w, 14.h),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.w),
            child: Row(children: [
              Icon(Icons.grid_view_rounded, size: 16.r, color: C.primary), SizedBox(width: 8.w),
              Expanded(child: Text('Horizontal Period Matrix', style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Text('← Swipe slots →', style: T.small.copyWith(fontSize: 11.sp)),
            ]),
          ),
          SizedBox(height: 10.h),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: _Matrix(periodsOf: state.periodsOf, now: now, selected: _day, onSelect: (d) => setState(() => _day = d)),
          ),
        ]),
      ),
      SectionHeader('${kDayLong[_day - 1]} Detailed Schedule'),
      Row(children: [
        Pill('${dayRows.where((p) => p.kind != PeriodKind.prep).length} Classes', tone: Tone.brand), SizedBox(width: 8.w),
        Text('${dayMonth(monday.add(Duration(days: _day - 1)))} ${monday.year}', style: T.small),
      ]),
      SizedBox(height: 10.h),
      for (final p in dayRows) _DetailRow(p: p, day: _day, now: now),
    ]);
  }
}

class _Matrix extends StatelessWidget {
  const _Matrix({required this.periodsOf, required this.now, required this.selected, required this.onSelect});
  final List<Period> Function(int day) periodsOf;
  final SchoolNow now;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final dayW = 64.w, cellW = 80.w, brkW = 56.w;
    double w(Slot s) => s.isBreak ? brkW : cellW;
    return Column(children: [
      Row(children: [
        SizedBox(width: dayW, child: Padding(padding: EdgeInsets.only(left: 4.w), child: Text('Day', style: T.smallStrong))),
        for (final s in kSlots)
          SizedBox(
            width: w(s),
            child: s.isBreak
                ? Center(child: Text(s.id == 'LNC' ? 'Lunch' : 'Break', style: T.smallStrong.copyWith(color: C.warningDark)))
                : Column(children: [Text(s.id, style: T.smallStrong.copyWith(color: C.slate)), Text(t12(s.start, suffix: false), style: T.small.copyWith(fontSize: 10.5.sp))]),
          ),
      ]),
      SizedBox(height: 6.h),
      for (var d = 1; d <= 6; d++) _row(context, d, dayW, w),
    ]);
  }

  Widget _row(BuildContext context, int d, double dayW, double Function(Slot) w) {
    final bySlot = {for (final p in periodsOf(d)) p.slot: p};
    final sel = d == selected;
    return Semantics(
      button: true, selected: sel, label: '${kDayLong[d - 1]} row',
      child: GestureDetector(
        onTap: () => onSelect(d),
        child: Container(
          height: 62.h, margin: EdgeInsets.only(bottom: 2.h),
          decoration: BoxDecoration(color: sel ? C.surface : Colors.transparent, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            SizedBox(
              width: dayW,
              child: Padding(
                padding: EdgeInsets.only(left: 4.w),
                child: Row(children: [
                  if (d == now.day) Container(width: 6.r, height: 6.r, margin: EdgeInsets.only(right: 4.w), decoration: const BoxDecoration(color: C.primary, shape: BoxShape.circle)),
                  Text(kDayShort[d - 1], style: T.smallStrong.copyWith(color: d == now.day ? C.primary : C.ink)),
                ]),
              ),
            ),
            for (final s in kSlots)
              SizedBox(
                width: w(s),
                child: s.isBreak ? Center(child: Text(s.id == 'LNC' ? '45m' : '15m', style: T.small.copyWith(color: C.warningDark))) : _cell(context, bySlot[s.id], d, s),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _cell(BuildContext context, Period? p, int d, Slot s) {
    if (p == null) return Center(child: Text('-', style: T.small));
    final live = statusOf(s, d, now) == PStatus.live;
    final kc = kindColors(p.kind);
    final prep = p.kind == PeriodKind.prep;
    return Center(
      child: GestureDetector(
        onTap: () {
          if (p.kind == PeriodKind.sub && p.subId != null) {
            context.push(RoutePaths.substitution(p.subId!));
          } else if (!prep) {
            AppDialogs.showSnackBar(context, message: '${kDayLong[d - 1]} ${s.id}: ${p.label} ${p.subject} • ${p.room}');
          } else {
            onSelect(d);
          }
        },
        child: Container(
          width: 66.w, padding: EdgeInsets.symmetric(vertical: 6.h),
          decoration: BoxDecoration(color: live ? C.primary : kc.bg, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: live ? C.primary : kc.fg.withValues(alpha: .25))),
          child: Text(prep ? 'Prep' : '${p.label}\n${p.short}', textAlign: TextAlign.center, maxLines: 2,
              style: T.small.copyWith(fontSize: 11.sp, height: 1.25, fontWeight: FontWeight.w700, color: live ? Colors.white : kc.fg)),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.p, required this.day, required this.now});
  final Period p;
  final int day;
  final SchoolNow now;
  @override
  Widget build(BuildContext context) {
    final s = slotOf(p.slot);
    final st = statusOf(s, day, now);
    final (label, tone) = p.kind == PeriodKind.sub
        ? ('Sub', Tone.warning)
        : p.kind == PeriodKind.prep
            ? ('Planning', Tone.neutral)
            : switch (st) { PStatus.done => ('Done', Tone.success), PStatus.live => ('Active', Tone.brand), PStatus.upcoming => ('Upcoming', Tone.neutral) };
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: AppCard(
        radius: R.lg, padding: EdgeInsets.all(12.r),
        onTap: p.kind == PeriodKind.sub && p.subId != null ? () => context.push(RoutePaths.substitution(p.subId!)) : null,
        child: Row(children: [
          SizedBox(width: 46.w, child: Column(children: [Text('P-${p.no}', style: T.smallStrong), Text(s.start, style: T.small)])),
          Container(width: 3.w, height: 34.h, margin: EdgeInsets.symmetric(horizontal: 8.w), color: kindColors(p.kind).fg.withValues(alpha: .4)),
          Expanded(child: Text(p.kind == PeriodKind.prep ? 'Free / Prep • ${p.room}' : '${p.subject} • Class ${p.label}', style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis)),
          SizedBox(width: 8.w),
          Pill(label, tone: tone),
        ]),
      ),
    );
  }
}

class _GridStat extends StatelessWidget {
  const _GridStat(this.label, this.value, this.sub, this.color);
  final String label, value, sub;
  final Color color;
  @override
  Widget build(BuildContext context) => AppCard(
        radius: R.lg, padding: EdgeInsets.all(12.r), color: C.bg, border: C.border,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
          SizedBox(height: 6.h),
          FittedBox(
            fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
            child: Text.rich(TextSpan(children: [TextSpan(text: value, style: T.stat.copyWith(color: color)), TextSpan(text: ' $sub', style: T.small)])),
          ),
        ]),
      );
}
