import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/models/attendance_models.dart' show AttCounts, dkey;
import '../../school/bloc/school_bloc.dart';
import '../bloc/timetable_bloc.dart';
import '../bloc/timetable_events.dart';
import '../bloc/timetable_states.dart';
import '../models/timetable_models.dart';
import 'widgets/teacher_tab_header.dart';
import 'widgets/timetable_date_sheet.dart';
import 'widgets/weekly_grid_view.dart';

/// Timetable tab (Figma 1153:20957 daily view; 1153:13882 weekly grid segment).
class TimetableScreen extends StatelessWidget {
  const TimetableScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<TimetableBloc>()..add(const TimetableLoadRequested()), child: const _TimetableView());
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

  /// Days picked as a range in the calendar (daily view lists each of them); null shows a single day.
  ({DateTime from, DateTime to})? _range;

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

  /// Full calendar with unmarked-attendance dots: one day opens the daily view, two days list the range.
  Future<void> _pickDate() async {
    final state = context.read<TimetableBloc>().state;
    final pick = await showTimetableDateSheet(
      context,
      from: _range?.from ?? _date,
      to: _range?.to,
      today: _now.at,
      missing: (d) => _unmarked(state, d),
    );
    if (pick == null || !mounted) return;
    setState(() {
      _weekly = false;
      _monday = mondayOf(pick.from);
      _day = schoolWorkingDays.contains(pick.from.weekday) ? pick.from.weekday : schoolWorkingDays.first;
      final to = pick.to;
      _range = to == null ? null : (from: pick.from, to: to);
    });
  }

  void _openDay(DateTime d) => setState(() {
    _range = null;
    _monday = mondayOf(d);
    _day = d.weekday;
  });

  /// Weekdays of the shown week (today or earlier) with a started class period that has no submitted register.
  Set<int> _missing(TimetableState state) => {
    for (final d in schoolWorkingDays)
      if (_unmarked(state, _monday.add(Duration(days: d - 1)))) d,
  };

  /// [date] is a school day (from the academic year start up to now) with a started class period and no submitted register.
  bool _unmarked(TimetableState state, DateTime date) {
    if (date.isAfter(_now.at) || date.isBefore(attendanceFlagsFrom(_now.at)) || !schoolWorkingDays.contains(date.weekday)) return false;
    final isToday = date.year == _now.at.year && date.month == _now.at.month && date.day == _now.at.day;
    final key = dkey(date);
    return state.periodsOf(date.weekday).any(
      (p) =>
          p.kind != PeriodKind.prep &&
          p.classId != null &&
          statusOf(slotOf(p.slot), isToday ? _now.day : 0, _now) != PStatus.upcoming &&
          !state.attendance.containsKey(TimetableState.attKey(key, p.classId!, int.tryParse(p.no) ?? 0)),
    );
  }

  /// The picked range: a summary line, then each school day with its timeline (tap a day header to open that day).
  List<Widget> _rangeList(TimetableState state, ({DateTime from, DateTime to}) range) {
    final days = [
      for (var d = range.from; !d.isAfter(range.to); d = DateTime(d.year, d.month, d.day + 1))
        if (schoolWorkingDays.contains(d.weekday)) d,
    ];
    final missing = days.where((d) => _unmarked(state, d)).length;
    return [
      Padding(
        padding: EdgeInsets.only(top: 8.h, bottom: 6.h),
        child: Row(
          children: [
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '${days.length} school ${days.length == 1 ? 'day' : 'days'}\n', style: T.h2),
                    TextSpan(
                      text: missing == 0 ? 'All attendance marked' : '$missing ${missing == 1 ? 'day has' : 'days have'} attendance to mark',
                      style: T.small.copyWith(color: missing == 0 ? C.successDark : C.danger, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _range = null),
              icon: Icon(Icons.close_rounded, size: 16.r),
              label: const Text('Clear'),
            ),
          ],
        ),
      ),
      for (final d in days) ...[
        _RangeDayHeader(
          date: d,
          today: d.year == _now.at.year && d.month == _now.at.month && d.day == _now.at.day,
          missing: _unmarked(state, d),
          count: state.periodsOf(d.weekday).where((p) => p.kind != PeriodKind.prep).length,
          onTap: () => _openDay(d),
        ),
        if (state.periodsOf(d.weekday).isEmpty)
          Padding(
            padding: EdgeInsets.only(left: 12.w, bottom: 12.h),
            child: Text('No periods', style: T.small),
          )
        else
          _Timeline(
            periods: state.periodsOf(d.weekday),
            now: _now,
            day: d.year == _now.at.year && d.month == _now.at.month && d.day == _now.at.day ? _now.day : (d.isBefore(_now.at) ? 0 : 7),
            date: d.isAfter(_now.at) ? '' : dkey(d),
            attendance: state.attendance,
            drafts: state.attDrafts,
          ),
      ],
    ];
  }

  Future<void> _sync() async {
    final bloc = context.read<TimetableBloc>()..add(const TimetableSyncRequested());
    await bloc.stream.firstWhere((s) => !s.syncing);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TimetableBloc>().state;
    final name = context.select<SchoolBloc, String?>((b) => b.state.teacher?.name);
    final range = _weekly ? null : _range;
    final dateLabel = range != null
        ? '${dayMonth(range.from)} – ${dayMonth(range.to)} ${range.to.year}'
        : _weekly
        ? '${dayMonth(_monday)} – ${dayMonth(_monday.add(const Duration(days: 5)))} ${_monday.year}'
        : _isToday
        ? 'Today, ${dayMonth(_date)}'
        : '${kDayShort[_day - 1]}, ${dayMonth(_date)}';
    final dayPeriods = state.periodsOf(_day);
    final lessons = dayPeriods.where((p) => p.kind != PeriodKind.prep).length;
    final free = dayPeriods.length - lessons;
    final subs = dayPeriods.where((p) => p.kind == PeriodKind.sub).length;
    final breaks = kSlots.where((sl) => sl.isBreak).length;
    final summary = [
      '$lessons ${lessons == 1 ? 'period' : 'periods'}',
      if (free > 0) '$free free',
      if (subs > 0) '$subs sub ${subs == 1 ? 'duty' : 'duties'}',
      if (breaks > 0) '$breaks ${breaks == 1 ? 'break' : 'breaks'}',
    ].join(' • ');
    return BlocListener<TimetableBloc, TimetableState>(
      listenWhen: (a, b) => b.syncCount > a.syncCount,
      listener: (context, _) => AppDialogs.showSnackBar(context, message: 'Calendar synced'),
      child: Column(
        children: [
          TeacherTabHeader(title: 'Timetable', subtitle: name),
          Expanded(
            // main column, then `side:` (the second column on wide screens)
            // ignore: sort_child_properties_last
            child: AppTabBody(
              onRefresh: _sync,
              side: [
                if (range != null) ..._rangeList(state, range),
                if (!_weekly && range == null) ...[
                  Padding(
                    padding: EdgeInsets.only(top: 8.h, bottom: 10.h),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(text: 'Schedule Timeline\n', style: T.h2),
                                TextSpan(text: summary, style: T.small),
                              ],
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          tooltip: state.syncing ? 'Syncing…' : 'Sync Calendar',
                          onPressed: state.syncing ? null : () => context.read<TimetableBloc>().add(const TimetableSyncRequested()),
                          icon: Icon(Icons.sync_rounded, size: 20.r, color: state.syncing ? C.muted : C.primary),
                        ),
                      ],
                    ),
                  ),
                  if (dayPeriods.isEmpty)
                    const AppEmptyState('No periods on this day', hint: 'The timetable has nothing scheduled for you here.', icon: Icons.event_available_outlined)
                  else
                    _Timeline(
                      periods: dayPeriods,
                      now: _now,
                      day: _isToday ? _now.day : (_date.isBefore(_now.at) ? 0 : 7),
                      date: _date.isAfter(_now.at) ? '' : dkey(_date),
                      attendance: state.attendance,
                      drafts: state.attDrafts,
                    ),
                  SizedBox(height: 4.h),
                  Center(
                    child: TextButton.icon(
                      onPressed: () => context.push(RoutePaths.weeklyGrid),
                      icon: Icon(Icons.grid_view_rounded, size: 18.r),
                      label: const Text('Open full weekly grid'),
                    ),
                  ),
                ],
              ],
              children: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: Icon(Icons.calendar_today_outlined, size: 16.r, color: C.primary),
                        label: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(dateLabel, style: T.bodyStrong.copyWith(fontSize: 13.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text(termWeekLabel(_date), style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                                ],
                              ),
                            ),
                            Icon(Icons.keyboard_arrow_down_rounded, size: 18.r, color: C.slate),
                          ],
                        ),
                        style: OutlinedButton.styleFrom(
                          minimumSize: Size(0, 48.h),
                          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                          side: const BorderSide(color: C.border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
                          alignment: Alignment.centerLeft,
                        ),
                      ),
                    ),
                    if (range != null || (!_isToday && !_weekly)) ...[
                      SizedBox(width: 8.w),
                      Semantics(
                        button: true,
                        label: 'Back to today',
                        child: OutlinedButton(
                          onPressed: () => setState(() { _range = null; _monday = _now.monday; _day = _now.day; }),
                          style: OutlinedButton.styleFrom(minimumSize: Size(0, 48.h), padding: EdgeInsets.symmetric(horizontal: 12.w), side: const BorderSide(color: C.border), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md))),
                          child: Text('Today', style: T.smallStrong.copyWith(color: C.primary)),
                        ),
                      ),
                    ],
                  ],
                ),
                SizedBox(height: 12.h),
                AppSegmented(
                  items: const ['Daily View', 'Weekly Grid'],
                  value: _weekly ? 'Weekly Grid' : 'Daily View',
                  track: true,
                  onChanged: (v) => setState(() {
                    _weekly = v == 'Weekly Grid';
                    if (_weekly && _range != null) _monday = mondayOf(_range!.from);
                  }),
                ),
                SizedBox(height: 12.h),
                if (_weekly)
                  WeeklyGridView(key: ValueKey(_monday), now: _now, weekStart: _monday)
                else if (range == null) ...[
                  _DayStrip(state: state, monday: _monday, day: _day, today: _now, missing: _missing(state), onPick: (d) => setState(() => _day = d)),
                  SizedBox(height: 14.h),
                  if (state.noticeFor(_day) case final sub?) _SubNotice(sub),
                  if (_isToday) _LiveCard(now: _now, today: state.periodsOf(_now.day), state: state),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A day in the range list: date, period count and a red "to mark" tag; opens the day.
class _RangeDayHeader extends StatelessWidget {
  const _RangeDayHeader({required this.date, required this.today, required this.missing, required this.count, required this.onTap});
  final DateTime date;
  final bool today, missing;
  final int count;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: 6.h, bottom: 8.h),
    child: InkWell(
      borderRadius: BorderRadius.circular(R.md),
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
        decoration: BoxDecoration(color: today ? C.primarySoft : C.surface, borderRadius: BorderRadius.circular(R.md)),
        child: Row(
          children: [
            Text('${kDayShort[date.weekday - 1]}, ${dayMonth(date)}${today ? ' • Today' : ''}', style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
            SizedBox(width: 8.w),
            Text('$count ${count == 1 ? 'period' : 'periods'}', style: T.small.copyWith(fontSize: 11.5.sp)),
            const Spacer(),
            if (missing) const Pill('To mark', tone: Tone.danger, dot: true),
            Icon(Icons.chevron_right_rounded, size: 18.r, color: C.slate),
          ],
        ),
      ),
    ),
  );
}

/// Mon–Sat chips: weekday, date, a period count. The real today carries a tinted border so the picked day and today read apart.
class _DayStrip extends StatelessWidget {
  const _DayStrip({required this.state, required this.monday, required this.day, required this.today, this.missing = const {}, required this.onPick});
  final TimetableState state;
  final DateTime monday;
  final int day;
  final SchoolNow today;

  /// Weekdays with attendance still to mark: a red dot on the chip.
  final Set<int> missing;
  final ValueChanged<int> onPick;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (final d in schoolWorkingDays)
        Expanded(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 3.w),
            child: Builder(builder: (context) {
              final date = monday.add(Duration(days: d - 1));
              final isToday = date.year == today.at.year && date.month == today.at.month && date.day == today.at.day;
              final count = state.periodsOf(d).where((p) => p.kind != PeriodKind.prep).length;
              final on = d == day;
              return Semantics(
                button: true,
                selected: on,
                label: '${kDayLong[d - 1]} ${date.day}, $count periods${isToday ? ', today' : ''}${missing.contains(d) ? ', attendance not marked' : ''}',
                child: InkWell(
                  borderRadius: BorderRadius.circular(R.lg),
                  onTap: () => onPick(d),
                  child: Stack(
                    children: [
                  Container(
                    width: double.infinity,
                    height: 64.h,
                    decoration: BoxDecoration(
                      color: on ? C.primary : C.bg,
                      borderRadius: BorderRadius.circular(R.lg),
                      border: Border.all(color: on ? C.primary : (isToday ? C.primary.withValues(alpha: .5) : C.border)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(kDayShort[d - 1].toUpperCase(), style: T.small.copyWith(fontSize: 10.sp, fontWeight: FontWeight.w700, color: on ? Colors.white70 : C.slate)),
                        FittedBox(child: Text('${date.day}', style: T.h3.copyWith(color: on ? Colors.white : C.ink))),
                        SizedBox(height: 3.h),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                          decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: .2) : C.surface, borderRadius: BorderRadius.circular(R.pill)),
                          child: Text(count == 0 ? '–' : '$count', style: T.small.copyWith(fontSize: 10.sp, fontWeight: FontWeight.w700, color: on ? Colors.white : C.slate)),
                        ),
                      ],
                    ),
                  ),
                      if (missing.contains(d))
                        Positioned(
                          top: 6.r,
                          right: 6.r,
                          child: Container(
                            key: ValueKey('att-missing-$d'),
                            width: 8.r,
                            height: 8.r,
                            decoration: BoxDecoration(
                              color: C.danger,
                              shape: BoxShape.circle,
                              border: Border.all(color: on ? Colors.white : C.bg, width: 1.5),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
    ],
  );
}

/// A substitution on the picked day: one strip that opens the brief.
class _SubNotice extends StatelessWidget {
  const _SubNotice(this.sub);
  final Substitution sub;
  @override
  Widget build(BuildContext context) {
    final accepted = sub.status == SubStatus.accepted;
    final slot = slotOf(sub.slot);
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.lg,
        color: C.warningSoft,
        border: C.warning.withValues(alpha: .4),
        onTap: () => context.push(RoutePaths.substitution(sub.id)),
        child: Row(
          children: [
            const IconTile(Icons.swap_horiz_rounded, tone: Tone.warning, size: 36),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    accepted ? 'Substitution accepted' : 'Substitution assigned • reply needed',
                    style: T.bodyStrong.copyWith(color: C.warningDark),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Period ${slot.id.substring(1)} • Class ${sub.classLabel} • ${sub.subject}${sub.faculty.isEmpty ? '' : ' • for ${sub.faculty}'}',
                    style: T.small.copyWith(color: C.warningDark),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            SizedBox(width: 6.w),
            Icon(Icons.chevron_right_rounded, color: C.warningDark, size: 22.r),
          ],
        ),
      ),
    );
  }
}

/// The period in progress right now, with one action.
class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.now, required this.today, required this.state});
  final SchoolNow now;
  final List<Period> today;
  final TimetableState state;
  @override
  Widget build(BuildContext context) {
    final live = nowInfo(today, now).live;
    if (live == null) return const SizedBox.shrink();
    final slot = slotOf(live.slot);
    final school = context.watch<SchoolBloc>().state;
    final cls = live.classId == null ? null : school.classById(live.classId!);
    final done = (now.minute - slot.startMin).clamp(0, slot.length);
    final subject = (cls?.subject ?? live.subject).replaceAll('Advanced ', '');
    final key = live.classId == null ? '' : TimetableState.attKey(dkey(now.at), live.classId!, int.tryParse(live.no) ?? 0);
    final marked = state.attendance[key];
    final draft = state.attDrafts.contains(key);
    return PanelCard(
      margin: EdgeInsets.only(bottom: 12.h),
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Pill('NOW HAPPENING', tone: Tone.brand, dot: true),
              SizedBox(width: 8.w),
              Expanded(
                child: Text('Period ${live.no} • ${t12(slot.start, suffix: false)} – ${t12(slot.end)}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              Text('${slot.length - done} min left', style: T.smallStrong.copyWith(color: C.primary)),
            ],
          ),
          SizedBox(height: 8.h),
          Text(subject, style: T.h1, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(
            'Class ${live.label} • ${live.room}${cls != null && cls.wing.isNotEmpty ? ' (${cls.wing})' : ''}${cls != null ? ' • ${cls.students} students' : ''}',
            style: T.body,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          SizedBox(height: 10.h),
          AppProgress(done / slot.length),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  marked != null ? 'Present ${marked.present + marked.late}/${marked.total}' : (draft ? 'Finish attendance' : 'Mark Attendance'),
                  icon: marked != null ? Icons.check_circle_outline_rounded : Icons.how_to_reg_outlined,
                  kind: marked != null ? BtnKind.soft : BtnKind.primary,
                  small: true,
                  onPressed: () => context.push(RoutePaths.markAttendance(classId: live.classId, period: int.tryParse(live.no))),
                ),
              ),
              SizedBox(width: 10.w),
              TextButton(
                onPressed: () => context.push(RoutePaths.lessonPlans),
                child: Text('Lesson plan ›', style: T.smallStrong.copyWith(color: C.primary)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Vertical timeline: a time rail on the left, one card per period, thin rows for breaks and free periods.
class _Timeline extends StatelessWidget {
  /// [day] is the weekday used for status: the real day when it is today, 0 (all done) for past dates, 7 (all upcoming) for future dates.
  const _Timeline({required this.periods, required this.now, required this.day, required this.date, this.attendance = const {}, this.drafts = const {}});
  final List<Period> periods;
  final SchoolNow now;
  final int day;

  /// The picked day (yyyy-MM-dd) when it is today or past: periods that have started show their attendance, or a
  /// button to mark it. Empty for future days.
  final String date;
  final Map<String, AttCounts> attendance;
  final Set<String> drafts;
  @override
  Widget build(BuildContext context) {
    final bySlot = {for (final p in periods) p.slot: p};
    final rows = <Widget>[];
    for (final sl in kSlots) {
      final st = statusOf(sl, day, now);
      if (sl.isBreak) {
        rows.add(_rail(
          time: t12(sl.start, suffix: false),
          dot: _Dot(color: C.warning, filled: st == PStatus.done, pulse: st == PStatus.live),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 6.h),
            child: Row(
              children: [
                Icon(Icons.local_cafe_outlined, size: 16.r, color: C.warningDark),
                SizedBox(width: 6.w),
                Expanded(
                  child: Text('${sl.label} • ${t12(sl.start)} – ${t12(sl.end)}', style: T.small.copyWith(color: C.warningDark, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ),
        ));
        continue;
      }
      final p = bySlot[sl.id];
      if (p == null) continue;
      if (p.kind == PeriodKind.prep) {
        rows.add(_rail(
          time: t12(sl.start, suffix: false),
          dot: _Dot(color: C.muted, filled: st == PStatus.done, pulse: st == PStatus.live),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 8.h),
            child: Text('Period ${p.no} • Free${p.room.isEmpty ? '' : ' • ${p.room}'}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ));
        continue;
      }
      final live = st == PStatus.live;
      final sub = p.kind == PeriodKind.sub;
      final color = sub ? C.warning : kindColors(p.kind).fg;
      final (label, tone) = sub
          ? ('Sub duty', Tone.warning)
          : switch (st) { PStatus.done => ('Done', Tone.success), PStatus.live => ('Now', Tone.brand), PStatus.upcoming => ('Upcoming', Tone.neutral) };
      final key = p.classId == null || date.isEmpty ? null : TimetableState.attKey(date, p.classId!, int.tryParse(p.no) ?? 0);
      final counts = key == null ? null : attendance[key];
      final draft = key != null && drafts.contains(key);
      final att = counts != null ? 'Present ${counts.present + counts.late}/${counts.total}' : '';
      // a class period (today or a past day) that has begun and has no submitted register yet
      final needsMark = key != null && counts == null && st != PStatus.upcoming;
      rows.add(_rail(
        time: t12(sl.start, suffix: false),
        end: t12(sl.end, suffix: false),
        dot: _Dot(color: live ? C.primary : color, filled: st == PStatus.done || live, pulse: live),
        child: AppCard(
          radius: R.lg,
          padding: EdgeInsets.fromLTRB(12.w, 10.h, 10.w, 10.h),
          margin: EdgeInsets.only(bottom: 10.h),
          color: live ? C.primarySoft : C.bg,
          border: live ? C.primary.withValues(alpha: .4) : C.border,
          onTap: sub && p.subId != null ? () => context.push(RoutePaths.substitution(p.subId!)) : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
            children: [
              Container(width: 3.w, height: 36.h, decoration: BoxDecoration(color: color.withValues(alpha: .6), borderRadius: BorderRadius.circular(2.r))),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.subject, style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                    SizedBox(height: 2.h),
                    Text(
                      'Period ${p.no} • Class ${p.label}${p.room.isEmpty ? '' : ' • ${p.room}'}${att.isEmpty ? '' : ' • $att'}',
                      style: T.small,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              SizedBox(width: 6.w),
              Pill(label, tone: tone, icon: st == PStatus.done && !sub ? Icons.check_circle_outline_rounded : null),
              if (sub) Icon(Icons.chevron_right_rounded, color: C.slate, size: 20.r),
            ],
              ),
              if (needsMark) ...[
                SizedBox(height: 10.h),
                Row(
                  children: [
                    Icon(Icons.error_outline_rounded, size: 15.r, color: draft ? C.warningDark : C.danger),
                    SizedBox(width: 5.w),
                    Expanded(
                      child: Text(
                        draft ? 'Draft saved • not submitted' : 'Attendance not marked',
                        style: T.small.copyWith(fontSize: 11.5.sp, fontWeight: FontWeight.w600, color: draft ? C.warningDark : C.danger),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    AppButton(
                      draft ? 'Finish' : 'Mark attendance',
                      key: ValueKey('mark-${p.slot}'),
                      icon: Icons.how_to_reg_outlined,
                      small: true,
                      expand: false,
                      onPressed: () => context.push(RoutePaths.markAttendance(classId: p.classId, period: int.tryParse(p.no), date: date)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ));
    }
    return Column(children: rows);
  }

  /// A timeline row: the time column, the rail with its dot, then [child].
  Widget _rail({required String time, String? end, required Widget dot, required Widget child}) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 44.w,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              SizedBox(height: 8.h),
              Text(time, style: T.smallStrong.copyWith(fontSize: 11.sp)),
              if (end != null) Text(end, style: T.small.copyWith(fontSize: 10.sp, color: C.muted)),
            ],
          ),
        ),
        SizedBox(
          width: 24.w,
          child: Stack(
            alignment: Alignment.topCenter,
            children: [
              Positioned.fill(child: Center(child: Container(width: 2.w, color: C.border))),
              Padding(padding: EdgeInsets.only(top: 10.h), child: dot),
            ],
          ),
        ),
        Expanded(child: child),
      ],
    ),
  );
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.filled, required this.pulse});
  final Color color;
  final bool filled, pulse;
  @override
  Widget build(BuildContext context) => Container(
    width: pulse ? 14.r : 10.r,
    height: pulse ? 14.r : 10.r,
    decoration: BoxDecoration(
      color: filled ? color : C.bg,
      shape: BoxShape.circle,
      border: Border.all(color: color, width: 2),
      boxShadow: pulse ? [BoxShadow(color: color.withValues(alpha: .35), blurRadius: 8, spreadRadius: 2)] : null,
    ),
  );
}
