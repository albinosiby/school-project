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
import 'widgets/att_widgets.dart';
import 'widgets/regularization_sheet.dart';

/// 1.1.3 Staff Self-Log (Figma 1153:15428) with the Regularization sheet (1153:14353).
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
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Staff Self-Log', fallbackRoute: RoutePaths.attendanceHistory, body: attLoading());
    final t = todayDate();
    final working = s.workingDays;
    return DetailScaffold(
      title: 'Staff Self-Log',
      fallbackRoute: RoutePaths.attendanceHistory,
      body: AttBody(children: [
        const AttTabs(2),
        SizedBox(height: 12.h),
        _PunchCard(s: s),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('ATTENDANCE CYCLE', style: T.capsMuted),
              Row(children: [
                Icon(Icons.calendar_month_rounded, size: 18.r, color: C.primary), SizedBox(width: 6.w),
                Flexible(child: Text(fmtKey(dkey(t), 'MMMM yyyy'), style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
            ])),
            Pill('${s.onTime.toStringAsFixed(1)}% On-Time', tone: Tone.brand, icon: Icons.verified_outlined),
          ]),
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(child: AttCountTile(start: true, label: 'WORKING', value: '$working', sub: 'Days')),
            SizedBox(width: 6.w),
            Expanded(child: AttCountTile(start: true, label: 'PRESENT', value: '${s.present}', sub: '${working == 0 ? 0 : (s.present * 100 / working).round()}% Rate', tone: Tone.brand)),
            SizedBox(width: 6.w),
            Expanded(child: AttCountTile(start: true, label: 'LATE', value: '${s.late}', sub: s.late == 0 ? 'None' : 'Delay', tone: Tone.warning)),
            SizedBox(width: 6.w),
            Expanded(child: AttCountTile(start: true, label: 'LEAVES', value: '${s.leaves}', sub: 'Casual', tone: Tone.purple)),
          ]),
        ])),
        SizedBox(height: 12.h),
        _WeekCard(s: s),
        SectionHeader('Recent Logs'),
        if (s.logs.isEmpty) const AppEmptyState('No logs yet'),
        for (final r in s.sorted.take(5)) _LogCard(r),
        SectionHeader('Leave Balances', caps: true),
        Row(children: [
          for (final q in s.quota) ...[
            if (q != s.quota.first) SizedBox(width: 8.w),
            Expanded(child: AppCard(radius: R.lg, padding: EdgeInsets.all(12.r), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(q.name, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              FittedBox(fit: BoxFit.scaleDown, child: Text('${q.available} / ${q.total}', style: T.h2)),
              Text('Available', style: T.small),
            ]))),
          ],
        ]),
        SectionHeader('Regularization Requests'),
        if (s.regs.isEmpty) AppCard(child: Text('No requests submitted yet.', style: T.body)),
        for (final r in s.regs)
          AppCard(
            margin: EdgeInsets.only(bottom: 8.h), radius: R.lg,
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${fmtKey(r.date, 'EEE, MMM d')} • ${r.type}', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('Proposed ${t12(r.time)} • ${r.reason}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
                if (r.decisionNote.isNotEmpty) Text('Admin note: ${r.decisionNote}', style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
              ])),
              Pill(r.status, tone: toneForStatus(r.status)),
            ]),
          ),
        SizedBox(height: 8.h),
        PanelCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Need to regularize a punch?', style: T.h3),
          Text('Submit missed punches or field duty requests for approval within 48 hours.', style: T.small),
          SizedBox(height: 12.h),
          AppButton('Request Attendance Regularization', icon: Icons.edit_calendar_outlined, onPressed: () async {
            final bloc = context.read<SelfLogBloc>();
            final r = await showRegularizationSheet(context, irregular: s.lastIrregular);
            if (r != null) bloc.add(SelfLogRegularizationSubmitted(r));
          }),
          SizedBox(height: 8.h),
          AppButton('Download My Timesheet (PDF)', icon: Icons.download_rounded, kind: BtnKind.outline, onPressed: () => toast(context, 'Timesheet downloaded (simulated)')),
        ])),
      ]),
    );
  }
}

class _PunchCard extends StatelessWidget {
  const _PunchCard({required this.s});
  final SelfLogState s;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<SelfLogBloc>();
    final row = s.today;
    final inT = row?.inTime, outT = row?.outTime;
    final logged = inT == null ? 0 : (mins(outT ?? nowHm()) - mins(inT)).clamp(0, 24 * 60);
    final pct = (logged / shiftMinutes).clamp(0, 1).toDouble();
    final onTime = inT != null && mins(inT) <= mins(onTimeBy);
    final toUnlock = mins(unlockAt) - mins(nowHm());
    return PanelCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Flexible(child: Container(
          padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.border)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: inT == null ? C.muted : C.success, shape: BoxShape.circle)),
            SizedBox(width: 6.w),
            Flexible(child: Text('Campus Main Gate', style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 4.w),
            Text(inT == null ? '(Not punched in)' : '(Verified)', style: T.small),
          ]),
        )),
        const Spacer(),
        if (inT != null) Pill(onTime ? 'On-Time' : 'Late', tone: onTime ? Tone.success : Tone.warning, dot: true),
      ]),
      SizedBox(height: 12.h),
      IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(child: Container(
          padding: EdgeInsets.all(12.r),
          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text('PUNCH IN', style: T.capsMuted)), Icon(Icons.fingerprint_rounded, size: 18.r, color: C.muted)]),
            FittedBox(fit: BoxFit.scaleDown, child: Text(inT == null ? '--:--' : t12(inT), style: T.title)),
            Text(inT == null ? 'Awaiting punch' : 'Terminal Gate B4', style: T.small),
          ]),
        )),
        SizedBox(width: 10.w),
        Expanded(child: Container(
          padding: EdgeInsets.all(12.r),
          decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('LOGGED', style: T.caps)),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                decoration: BoxDecoration(color: outT != null ? C.slate : inT != null ? C.primary : C.muted, borderRadius: BorderRadius.circular(4.r)),
                child: Text(outT != null ? 'COMPLETE' : inT != null ? 'ACTIVE' : 'READY', style: T.smallStrong.copyWith(color: Colors.white, fontSize: 10.sp)),
              ),
            ]),
            FittedBox(fit: BoxFit.scaleDown, child: Text('${logged ~/ 60}h ${logged % 60}m', style: T.title.copyWith(color: C.primary))),
            Text('${(pct * 100).round()}% of Shift Completed', style: T.small),
          ]),
        )),
      ])),
      SizedBox(height: 12.h),
      Container(
        padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
        child: Column(children: [
          Row(children: [
            Icon(Icons.schedule_rounded, size: 16.r, color: C.primary), SizedBox(width: 6.w),
            Expanded(child: Text('Morning Shift • ${t12(shiftStart)} – ${t12(shiftEnd)}', style: T.small.copyWith(color: C.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Text('8h 30m Total', style: T.small),
          ]),
          SizedBox(height: 8.h),
          AppProgress(pct),
          SizedBox(height: 8.h),
          Row(children: [
            Icon(Icons.lock_clock_outlined, size: 16.r, color: C.primary), SizedBox(width: 6.w),
            Expanded(child: Text(
              outT != null ? 'Shift closed' : toUnlock > 0 ? 'Eligible in ${toUnlock ~/ 60}h ${toUnlock % 60}m' : 'Check-out unlocked',
              style: T.smallStrong.copyWith(color: C.primary),
            )),
            Text('Unlock at ${t12(unlockAt)}', style: T.small),
          ]),
        ]),
      ),
      SizedBox(height: 14.h),
      if (inT == null)
        AppButton('Punch In', icon: Icons.login_rounded, onPressed: () {
          final now = nowHm();
          bloc.add(SelfLogPunchedIn(now));
          toast(context, 'Punched in at ${t12(now)}');
        })
      else if (outT == null)
        AppButton(toUnlock > 0 ? 'Punch Out / Check-Out (Early)' : 'Punch Out / Check-Out', icon: Icons.logout_rounded, kind: BtnKind.outline, onPressed: () async {
          if (mins(nowHm()) < mins(unlockAt)) {
            final ok = await AppDialogs.showConfirmDialog(context,
                title: 'Punch out early?', message: 'Your shift ends at 04:30 PM (unlocks 04:00 PM). Early check-out will be logged as a short day.', confirm: 'Punch Out');
            if (!ok || !context.mounted) return;
          }
          final now = nowHm();
          bloc.add(SelfLogPunchedOut(now));
          toast(context, 'Punched out at ${t12(now)}');
        })
      else
        Text('Checked out at ${t12(outT)} • Total ${logged ~/ 60}h ${logged % 60}m logged', style: T.bodyStrong.copyWith(color: C.successDark)),
      SizedBox(height: 6.h),
      Text('Auto-unlocks at mandatory shift end (04:30 PM) or via admin approval', style: T.small, textAlign: TextAlign.center),
    ]));
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
    return AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('Weekly Streak', style: T.h2),
        SizedBox(width: 8.w),
        Pill('${s.streak} Days Clean', tone: Tone.brand),
        const Spacer(),
        Flexible(child: Text('Week ${((t.day - 1) ~/ 7) + 1} • ${fmtKey(today, 'MMM yyyy')}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ]),
      SizedBox(height: 12.h),
      Row(children: [
        for (var i = 0; i < 7; i++)
          Expanded(child: Builder(builder: (_) {
            final d = weekStart.add(Duration(days: i));
            final r = s.logs.where((e) => e.date == dkey(d)).firstOrNull;
            final off = d.weekday > 5;
            final label = off ? 'OFF' : r == null ? (d.isAfter(t) ? '-' : 'A') : switch (r.status) { 'Present' => 'P', 'Late' => 'L', 'Leave' => 'LV', _ => '!' };
            final tone = off || r == null ? Tone.neutral : switch (r.status) { 'Present' => Tone.success, 'Late' => Tone.warning, 'Leave' => Tone.brand, _ => Tone.danger };
            final isToday = dkey(d) == today;
            final c = toneColors(tone);
            return Semantics(
              label: '${fmtKey(dkey(d), 'EEEE d')}: $label',
              child: Container(
                margin: EdgeInsets.symmetric(horizontal: 2.w), padding: EdgeInsets.symmetric(vertical: 6.h),
                decoration: BoxDecoration(
                  color: isToday ? C.primary : c.bg.withValues(alpha: .6), borderRadius: BorderRadius.circular(R.md),
                  border: Border.all(color: isToday ? C.primary : C.border),
                ),
                child: Column(children: [
                  Text(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i], style: T.small.copyWith(fontSize: 10.sp, color: isToday ? Colors.white : C.slate)),
                  Text('${d.day}', style: T.smallStrong.copyWith(fontSize: 14.sp, color: isToday ? Colors.white : C.ink)),
                  FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: T.smallStrong.copyWith(fontSize: 10.sp, color: isToday ? Colors.white : c.fg))),
                ]),
              ),
            );
          })),
      ]),
      SizedBox(height: 10.h),
      const AppChartLegend(boxed: false, center: false, items: [
        AppLegendItem('Present (On-Time)', C.success, dot: true),
        AppLegendItem('Late Entry', C.warning, dot: true),
        AppLegendItem('Leave / Regularized', C.primary, dot: true),
      ]),
    ]));
  }
}

class _LogCard extends StatelessWidget {
  const _LogCard(this.r);
  final StaffLog r;
  @override
  Widget build(BuildContext context) {
    final inT = r.inTime, outT = r.outTime;
    final total = inT != null && outT != null ? mins(outT) - mins(inT) : null;
    final pill = r.status == 'Present' ? (outT == null ? 'Active Session' : 'Complete') : r.status;
    final tone = switch (r.status) { 'Present' => outT == null ? Tone.brand : Tone.success, 'Late' => Tone.warning, 'Leave' => Tone.purple, _ => Tone.danger };
    Widget kv(String k, String v) => Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k, style: T.small.copyWith(fontSize: 11.sp)), Text(v, style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]));
    return AppCard(
      margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, padding: EdgeInsets.all(14.r),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(fmtKey(r.date, 'EEE, MMM d'), style: T.bodyStrong)),
          Pill(pill, tone: tone),
        ]),
        if (r.status != 'Leave') ...[
          SizedBox(height: 8.h),
          Row(children: [
            kv('Punch In', inT == null ? 'Missed' : t12(inT)),
            kv('Punch Out', outT == null ? (r.date == dkey(todayDate()) ? 'In Progress' : 'Missed') : t12(outT)),
            kv('Total Logged', total == null ? (r.date == dkey(todayDate()) ? 'Ongoing' : '--') : '${total ~/ 60}h ${total % 60}m'),
          ]),
        ],
        SizedBox(height: 6.h),
        Text(r.note, style: T.small),
      ]),
    );
  }
}
