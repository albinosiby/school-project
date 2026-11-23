import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/load_status.dart';
import '../bloc/self_log_bloc.dart';
import '../bloc/self_log_events.dart';
import '../bloc/self_log_states.dart';
import '../models/attendance_models.dart';
import '../models/leave_models.dart';
import 'widgets/att_widgets.dart';

/// 1.1.3 Staff Self-Log (Figma 1153:15428).
///
/// Layout, top to bottom: today's check-in / check-out card with one action, this month's
/// numbers, the week strip, recent days and the leave balance.
class SelfLogScreen extends StatelessWidget {
  const SelfLogScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<SelfLogBloc>()..add(const SelfLogLoadRequested()), child: const _SelfLogView());
}

class _SelfLogView extends StatelessWidget {
  const _SelfLogView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SelfLogBloc>().state;
    if (s.status != LoadStatus.loaded) {
      return DetailScaffold(title: 'My Attendance', subtitle: 'Staff Self-Log', fallbackRoute: RoutePaths.attendanceHistory, body: attLoading());
    }
    return DetailScaffold(
      title: 'My Attendance',
      subtitle: 'Staff Self-Log',
      fallbackRoute: RoutePaths.attendanceHistory,
      body: AttBody(
        bottom: 32,
        children: [
          _TodayCard(s: s),
          SizedBox(height: 14.h),
          const _TimingsCard(),
          SizedBox(height: 14.h),
          _MonthCard(s: s),
          SizedBox(height: 14.h),
          _WeekCard(s: s),
          const _Heading('Recent days'),
          _RecentDays(logs: s.sorted.take(7).toList()),
          const _Heading('Leave balance'),
          _LeaveCard(quota: s.quota),
        ],
      ),
    );
  }
}

String _hm(int minutes) => '${minutes ~/ 60}h ${minutes % 60}m';

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.s});
  final SelfLogState s;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<SelfLogBloc>();
    final row = s.today;
    final inT = row?.inTime, outT = row?.outTime;
    final now = nowHm();
    final logged = inT == null ? 0 : (mins(outT ?? now) - mins(inT)).clamp(0, 24 * 60);
    final pct = (logged / shiftMinutes).clamp(0, 1).toDouble();
    final onTime = inT != null && mins(inT) <= mins(onTimeBy);
    final early = mins(now) < mins(unlockAt);

    final (headline, tone, icon) = outT != null
        ? ('Day complete', Tone.success, Icons.check_circle_rounded)
        : inT != null
            ? (onTime ? 'Checked in • On time' : 'Checked in • Late', onTime ? Tone.success : Tone.warning, Icons.fingerprint_rounded)
            : ('Not checked in yet', Tone.neutral, Icons.fingerprint_rounded);
    final sub = outT != null
        ? 'You logged ${_hm(logged)} today.'
        : inT != null
            ? (early ? 'Check-out opens at ${t12(unlockAt)}. Shift ends ${t12(shiftEnd)}.' : 'Check-out is open. Shift ends ${t12(shiftEnd)}.')
            : 'Check in by ${t12(onTimeBy)} to be on time.';

    return PanelCard(
      padding: EdgeInsets.all(16.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconTile(icon, tone: tone, size: 44),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fmtKey(dkey(todayDate()), 'EEEE, MMM d').toUpperCase(), style: T.capsMuted),
                    SizedBox(height: 2.h),
                    Text(headline, style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          // Check-in → check-out timeline.
          Container(
            padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
            child: Row(
              children: [
                Expanded(child: _Step('CHECK-IN', inT == null ? '--:--' : t12(inT), done: inT != null)),
                _Connector(active: inT != null && outT == null, done: outT != null),
                Expanded(child: _Step('CHECK-OUT', outT == null ? '--:--' : t12(outT), done: outT != null, end: true)),
              ],
            ),
          ),
          if (inT != null) ...[
            SizedBox(height: 12.h),
            Row(
              children: [
                Expanded(child: Text(outT == null ? 'Logged so far' : 'Logged today', style: T.small)),
                Text(_hm(logged), style: T.smallStrong.copyWith(color: C.primary)),
              ],
            ),
            SizedBox(height: 6.h),
            AppProgress(pct, tone: outT == null ? Tone.brand : Tone.success),
          ],
          SizedBox(height: 14.h),
          if (inT == null)
            AppButton('Check In', icon: Icons.login_rounded, onPressed: () {
              final t = nowHm();
              bloc.add(SelfLogPunchedIn(t));
              toast(context, 'Checked in at ${t12(t)}');
            })
          else if (outT == null)
            AppButton(early ? 'Check Out early' : 'Check Out', icon: Icons.logout_rounded, kind: early ? BtnKind.outline : BtnKind.primary, onPressed: () async {
              if (mins(nowHm()) < mins(unlockAt)) {
                final ok = await AppDialogs.showConfirmDialog(context,
                    title: 'Check out early?',
                    message: 'Check-out opens at ${t12(unlockAt)} and your shift ends at ${t12(shiftEnd)}. An early check-out is logged as a short day.',
                    confirm: 'Check Out');
                if (!ok || !context.mounted) return;
              }
              final t = nowHm();
              bloc.add(SelfLogPunchedOut(t));
              toast(context, 'Checked out at ${t12(t)}');
            })
          else
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
              decoration: BoxDecoration(color: C.successSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Row(
                children: [
                  Icon(Icons.check_rounded, size: 18.r, color: C.successDark),
                  SizedBox(width: 8.w),
                  Expanded(child: Text('Checked out at ${t12(outT)}. See you tomorrow.', style: T.smallStrong.copyWith(color: C.successDark))),
                ],
              ),
            ),
          SizedBox(height: 8.h),
          Text(sub, style: T.small, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step(this.label, this.time, {required this.done, this.end = false});
  final String label, time;
  final bool done, end;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
    children: [
      Text(label, style: T.capsMuted.copyWith(fontSize: 9.5.sp)),
      SizedBox(height: 2.h),
      FittedBox(fit: BoxFit.scaleDown, child: Text(time, style: T.h1.copyWith(color: done ? C.ink : C.muted))),
    ],
  );
}

/// Dotted line between the two steps; a filled dot moves to the end once checked out.
class _Connector extends StatelessWidget {
  const _Connector({required this.active, required this.done});
  final bool active, done;
  @override
  Widget build(BuildContext context) {
    final color = done ? C.success : active ? C.primary : C.border;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 10.w),
      child: Row(
        children: [
          Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: active || done ? color : C.muted, shape: BoxShape.circle)),
          Container(width: 34.w, height: 2, margin: EdgeInsets.symmetric(horizontal: 4.w), color: color),
          Container(
            width: 8.r,
            height: 8.r,
            decoration: BoxDecoration(color: done ? color : C.bg, shape: BoxShape.circle, border: Border.all(color: done ? color : C.muted, width: 1.5)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Regular timings
// ---------------------------------------------------------------------------

/// The shift window and cut-offs every check-in is judged against.
class _TimingsCard extends StatelessWidget {
  const _TimingsCard();
  @override
  Widget build(BuildContext context) {
    final total = mins(shiftEnd) - mins(shiftStart);
    double at(String hm) => ((mins(hm) - mins(shiftStart)) / total).clamp(0, 1).toDouble();
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconTile(Icons.schedule_rounded, size: 34),
              SizedBox(width: 10.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Regular timings', style: T.h3),
                    Text('${t12(shiftStart)} – ${t12(shiftEnd)} • ${_hm(total)} shift', style: T.small),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14.h),
          // Shift bar with the on-time and check-out markers.
          LayoutBuilder(
            builder: (_, box) => SizedBox(
              height: 34.h,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 12.h,
                    child: Container(height: 8.h, decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.pill))),
                  ),
                  Positioned(
                    left: 0,
                    width: box.maxWidth * at(onTimeBy),
                    top: 12.h,
                    child: Container(height: 8.h, decoration: BoxDecoration(color: C.success, borderRadius: BorderRadius.horizontal(left: Radius.circular(R.pill)))),
                  ),
                  Positioned(
                    left: box.maxWidth * at(unlockAt),
                    right: 0,
                    top: 12.h,
                    child: Container(height: 8.h, decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.horizontal(right: Radius.circular(R.pill)))),
                  ),
                  for (final (hm, color) in [(onTimeBy, C.success), (unlockAt, C.primary)])
                    Positioned(
                      left: box.maxWidth * at(hm) - 7.r,
                      top: 9.h,
                      child: Container(
                        width: 14.r,
                        height: 14.r,
                        decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: color, width: 3)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(height: 4.h),
          Row(
            children: [
              _Timing('Shift starts', t12(shiftStart), Tone.neutral),
              SizedBox(width: 8.w),
              _Timing('On time until', t12(onTimeBy), Tone.success),
              SizedBox(width: 8.w),
              _Timing('Check-out from', t12(unlockAt), Tone.brand),
              SizedBox(width: 8.w),
              _Timing('Shift ends', t12(shiftEnd), Tone.neutral),
            ],
          ),
          SizedBox(height: 10.h),
          Text('Check in after ${t12(onTimeBy)} counts as late. Checking out before ${t12(unlockAt)} is logged as a short day.', style: T.small),
          SizedBox(height: 14.h),
          const Divider(height: 1, color: C.border),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(child: Text('Working days', style: T.bodyStrong)),
              Text('Monday – Friday', style: T.small),
            ],
          ),
          SizedBox(height: 10.h),
          Row(
            children: [
              for (var i = 1; i <= 7; i++) ...[
                if (i > 1) SizedBox(width: 6.w),
                Expanded(
                  child: Semantics(
                    label: '${const ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i - 1]}: ${workingWeekday(i) ? 'working day' : 'off'}',
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: 8.h),
                      decoration: BoxDecoration(
                        color: workingWeekday(i) ? C.primary : C.surface,
                        borderRadius: BorderRadius.circular(R.md),
                        border: Border.all(color: workingWeekday(i) ? C.primary : C.border),
                      ),
                      child: Column(
                        children: [
                          Text(const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i - 1], style: T.smallStrong.copyWith(fontSize: 11.sp, color: workingWeekday(i) ? Colors.white : C.slate)),
                          SizedBox(height: 2.h),
                          Icon(workingWeekday(i) ? Icons.work_outline_rounded : Icons.weekend_outlined, size: 14.r, color: workingWeekday(i) ? Colors.white70 : C.muted),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: 8.h),
          Text('Saturday and Sunday are off. Attendance is counted on working days only.', style: T.small),
        ],
      ),
    );
  }
}

class _Timing extends StatelessWidget {
  const _Timing(this.label, this.value, this.tone);
  final String label, value;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          SizedBox(height: 2.h),
          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: T.smallStrong.copyWith(color: tone == Tone.neutral ? C.ink : c.fg, fontSize: 13.sp))),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Month & week
// ---------------------------------------------------------------------------

class _MonthCard extends StatelessWidget {
  const _MonthCard({required this.s});
  final SelfLogState s;
  @override
  Widget build(BuildContext context) {
    final working = s.workingDays;
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(fmtKey(dkey(todayDate()), 'MMMM yyyy'), style: T.h3)),
              Text('${s.present} of $working working days', style: T.small),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              _MiniStat('${s.present}', 'Present', Tone.success),
              SizedBox(width: 8.w),
              _MiniStat('${s.late}', 'Late', Tone.warning),
              SizedBox(width: 8.w),
              _MiniStat('${s.leaves}', 'Leaves', Tone.purple),
              SizedBox(width: 8.w),
              _MiniStat('${s.onTime.round()}%', 'On time', Tone.brand),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat(this.value, this.label, this.tone);
  final String value, label;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 10.h),
        decoration: BoxDecoration(color: c.bg.withValues(alpha: .6), borderRadius: BorderRadius.circular(R.md)),
        child: Column(
          children: [
            FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h2.copyWith(color: c.fg, fontWeight: FontWeight.w800))),
            SizedBox(height: 2.h),
            Text(label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _WeekCard extends StatelessWidget {
  const _WeekCard({required this.s});
  final SelfLogState s;
  @override
  Widget build(BuildContext context) {
    final t = todayDate();
    final weekStart = t.subtract(Duration(days: t.weekday - 1));
    final today = dkey(t);
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('This week', style: T.h3)),
              if (s.streak > 0) Pill('${s.streak}-day streak', tone: Tone.success, icon: Icons.local_fire_department_rounded),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: Builder(builder: (_) {
                    final d = weekStart.add(Duration(days: i));
                    final key = dkey(d);
                    final r = s.logs.where((e) => e.date == key).firstOrNull;
                    final off = !workingWeekday(d.weekday);
                    final future = d.isAfter(t);
                    final (String label, Tone tone) = off
                        ? ('Off', Tone.neutral)
                        : r == null
                            ? (future ? ('Upcoming', Tone.neutral) : ('Absent', Tone.danger))
                            : switch (r.status) {
                                'Present' => ('Present', Tone.success),
                                'Late' => ('Late', Tone.warning),
                                'Leave' => ('Leave', Tone.purple),
                                _ => ('Missed', Tone.danger),
                              };
                    final isToday = key == today;
                    final c = toneColors(tone);
                    return Semantics(
                      label: '${fmtKey(key, 'EEEE d')}: $label',
                      child: Container(
                        margin: EdgeInsets.symmetric(horizontal: 2.w),
                        padding: EdgeInsets.symmetric(vertical: 8.h),
                        decoration: BoxDecoration(
                          color: isToday ? C.primary : C.surface,
                          borderRadius: BorderRadius.circular(R.md),
                          border: Border.all(color: isToday ? C.primary : C.border),
                        ),
                        child: Column(
                          children: [
                            Text(['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], style: T.small.copyWith(fontSize: 10.sp, color: isToday ? Colors.white70 : C.slate)),
                            SizedBox(height: 2.h),
                            Text('${d.day}', style: T.smallStrong.copyWith(fontSize: 14.sp, color: isToday ? Colors.white : C.ink)),
                            SizedBox(height: 6.h),
                            Container(
                              width: 8.r,
                              height: 8.r,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: tone == Tone.neutral ? Colors.transparent : (isToday ? Colors.white : c.fg),
                                border: tone == Tone.neutral ? Border.all(color: isToday ? Colors.white54 : C.border) : null,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ),
            ],
          ),
          SizedBox(height: 10.h),
          const AppChartLegend(boxed: false, center: false, items: [
            AppLegendItem('Present', C.success, dot: true),
            AppLegendItem('Late', C.warning, dot: true),
            AppLegendItem('Leave', C.purple, dot: true),
            AppLegendItem('Absent / missed', C.danger, dot: true),
          ]),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Recent days
// ---------------------------------------------------------------------------

class _Heading extends StatelessWidget {
  const _Heading(this.title);
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(2.w, 20.h, 2.w, 10.h),
    child: Text(title, style: T.h3),
  );
}

class _RecentDays extends StatelessWidget {
  const _RecentDays({required this.logs});
  final List<StaffLog> logs;
  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) return const AppCard(child: AppEmptyState('No days logged yet', hint: 'Your check-ins will show up here.'));
    final today = dkey(todayDate());
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < logs.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: C.border),
            _DayRow(logs[i], isToday: logs[i].date == today),
          ],
        ],
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow(this.r, {required this.isToday});
  final StaffLog r;
  final bool isToday;
  @override
  Widget build(BuildContext context) {
    final inT = r.inTime, outT = r.outTime;
    final total = inT != null && outT != null ? mins(outT) - mins(inT) : null;
    final (status, tone) = switch (r.status) {
      'Present' => outT == null && isToday ? ('In progress', Tone.brand) : ('Present', Tone.success),
      'Late' => ('Late', Tone.warning),
      'Leave' => ('Leave', Tone.purple),
      _ => ('Missed punch', Tone.danger),
    };
    final times = r.status == 'Leave'
        ? (r.note.isEmpty ? 'On leave' : r.note)
        : '${inT == null ? '--:--' : t12(inT)}  →  ${outT == null ? (isToday ? 'now' : '--:--') : t12(outT)}';
    final d = DateTime.tryParse(r.date);
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
      child: Row(
        children: [
          // Date block.
          Container(
            width: 44.r,
            padding: EdgeInsets.symmetric(vertical: 6.h),
            decoration: BoxDecoration(color: isToday ? C.primarySoft : C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Column(
              children: [
                Text(d == null ? '' : fmtKey(r.date, 'EEE').toUpperCase(), style: T.capsMuted.copyWith(fontSize: 9.sp, color: isToday ? C.primary : C.slate)),
                Text(d == null ? '' : '${d.day}', style: T.h3.copyWith(color: isToday ? C.primary : C.ink)),
              ],
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(times, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                SizedBox(height: 2.h),
                Text(
                  total != null ? '${_hm(total)} logged' : (isToday && inT != null ? 'Ongoing' : r.status == 'Leave' ? fmtKey(r.date, 'MMM d, yyyy') : 'Incomplete day'),
                  style: T.small,
                ),
              ],
            ),
          ),
          SizedBox(width: 8.w),
          Pill(status, tone: tone),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Leave balance
// ---------------------------------------------------------------------------

class _LeaveCard extends StatelessWidget {
  const _LeaveCard({required this.quota});
  final List<LeaveQuota> quota;
  @override
  Widget build(BuildContext context) {
    if (quota.isEmpty) return const AppCard(child: AppEmptyState('No leave quota set'));
    return AppCard(
      radius: R.xl,
      padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 6.h),
      child: Column(
        children: [
          for (var i = 0; i < quota.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: C.border),
            Padding(
              padding: EdgeInsets.symmetric(vertical: 10.h),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(quota[i].name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
                            Text.rich(TextSpan(children: [
                              TextSpan(text: '${quota[i].available}', style: T.h3.copyWith(color: C.primary)),
                              TextSpan(text: ' / ${quota[i].total} left', style: T.small),
                            ])),
                          ],
                        ),
                        SizedBox(height: 6.h),
                        AppProgress(quota[i].total == 0 ? 0 : (quota[i].available / quota[i].total).clamp(0, 1).toDouble(), height: 6),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
