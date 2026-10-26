import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/load_status.dart';
import '../bloc/overview_bloc.dart';
import '../bloc/overview_events.dart';
import '../bloc/overview_states.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';

/// 1.2 Attendance overview (Figma 1153:16658).
class AttendanceOverviewScreen extends StatelessWidget {
  const AttendanceOverviewScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<OverviewBloc>()..add(const OverviewLoadRequested()), child: const _OverviewView());
}

String _markPath(String classId, int period) => Uri(path: RoutePaths.attendanceMark, queryParameters: {'class': classId, 'period': '$period'}).toString();

class _OverviewView extends StatelessWidget {
  const _OverviewView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<OverviewBloc>().state;
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Attendance', body: attLoading());
    final today = dkey(todayDate());
    final nowM = DateTime.now().hour * 60 + DateTime.now().minute;
    final home = s.home;
    final trend = s.homeTrend;
    final tot = s.todayTotals(nowM);
    final below = s.belowThreshold;
    final slips = s.pendingSlips;
    final delta = trend.overall - trend.previous;
    return DetailScaffold(
      title: 'Attendance',
      body: AttBody(children: [
        Row(children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.border)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.calendar_today_rounded, size: 14.r, color: C.primary), SizedBox(width: 6.w),
              Text('${fmtKey(today, 'MMM d')}, Today • Term 2', style: T.smallStrong),
            ]),
          ),
          SizedBox(width: 8.w),
          Flexible(child: Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
            decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.primary.withValues(alpha: .3))),
            child: Text('Grade ${home?.label ?? ''} Homeroom', style: T.smallStrong.copyWith(color: C.primary), maxLines: 1, overflow: TextOverflow.ellipsis),
          )),
        ]),
        if (below > 0) ...[
          SizedBox(height: 12.h),
          AttBanner(
            icon: Icons.warning_amber_rounded, text: '$below students below 75% attendance',
            trailing: Text('Review ›', style: T.smallStrong.copyWith(color: C.warningDark)),
            onTap: () => context.push(RoutePaths.attendanceTrends),
          ),
        ],
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Text('${trend.overall.toStringAsFixed(1)}%', style: T.title.copyWith(color: C.primary, fontSize: 28.sp)), SizedBox(width: 6.w),
            Expanded(child: Text('Overall Attendance', style: T.small, maxLines: 2)),
            Pill('${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1)}% this week', tone: delta >= 0 ? Tone.success : Tone.danger),
          ]),
          SizedBox(height: 8.h),
          AppProgress(trend.overall / 100),
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(child: _Mini('Present', '${tot.present}', '/${tot.total}', C.success)),
            SizedBox(width: 8.w),
            Expanded(child: _Mini('Absent', two(tot.absent), 'students', C.danger)),
            SizedBox(width: 8.w),
            Expanded(child: _Mini('Unmarked', two(tot.unmarked), 'classes', C.warning)),
          ]),
        ])),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: AppButton('Mark Attendance', icon: Icons.fact_check_outlined, onPressed: () => context.push(RoutePaths.attendanceMark))),
          SizedBox(width: 8.w),
          _SquareBtn(icon: Icons.qr_code_scanner_rounded, tip: 'Scan QR attendance', onTap: () => toast(context, 'QR scan attendance is simulated')),
          SizedBox(width: 8.w),
          _SquareBtn(icon: Icons.file_download_outlined, tip: 'Download report', onTap: () => toast(context, 'Attendance report downloaded (simulated)')),
        ]),
        SectionHeader('Assigned Periods Today', action: 'Timetable →', onAction: () => context.go(RoutePaths.timetable)),
        Text('${s.schedule.length} Sessions', style: T.small),
        SizedBox(height: 8.h),
        for (final sc in s.schedule) _PeriodCard(sc: sc, s: s, nowM: nowM),
        SectionHeader('Pending Leave Slips', action: slips.isEmpty ? null : '${slips.length} New'),
        if (slips.isEmpty) const AppCard(child: AppEmptyState('No pending leave slips', hint: 'All student leave requests are reviewed.', icon: Icons.task_alt_rounded)),
        for (final sl in slips) _SlipRow(sl: sl, s: s),
      ]),
    );
  }
}

class _SquareBtn extends StatelessWidget {
  const _SquareBtn({required this.icon, required this.tip, required this.onTap});
  final IconData icon;
  final String tip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => IconButton.outlined(
        tooltip: tip, onPressed: onTap, icon: Icon(icon, size: 22.r),
        style: IconButton.styleFrom(side: const BorderSide(color: C.border), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md))),
        constraints: BoxConstraints(minWidth: 52.r, minHeight: 52.r),
      );
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.sc, required this.s, required this.nowM});
  final ScheduleSlot sc;
  final OverviewState s;
  final int nowM;
  @override
  Widget build(BuildContext context) {
    final cls = s.classById(sc.classId);
    final p = sc.period;
    final r = s.recordFor(sc);
    final done = r != null && r.submitted;
    final started = mins(periodTimes[p]!.$1) <= nowM;
    final status = done ? 'Completed' : (r != null || started) ? 'In Progress' : 'Upcoming';
    final c = r?.counts;
    final live = status == 'In Progress';
    final startsIn = mins(periodTimes[p]!.$1) - nowM;
    return AppCard(
      margin: EdgeInsets.only(bottom: 10.h), radius: R.xl,
      color: live ? C.panel : C.bg, border: live ? C.panelBorder : C.border,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
            decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.sm)),
            child: Text('Grade ${cls?.label ?? ''}', style: T.smallStrong.copyWith(color: C.primary)),
          ),
          SizedBox(width: 8.w),
          Expanded(child: Text('Period $p • ${periodRange(p)}', style: T.smallStrong.copyWith(fontSize: 11.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
          Pill(status, tone: done ? Tone.success : live ? Tone.brand : Tone.neutral, dot: live, icon: done ? Icons.check_circle_outline_rounded : null),
        ]),
        SizedBox(height: 10.h),
        if (done)
          Row(children: [
            Expanded(child: Text.rich(TextSpan(children: [
              TextSpan(text: '${c!.present + c.late} Present', style: T.bodyStrong.copyWith(fontSize: 13.5.sp)),
              TextSpan(text: ' / ${c.total}  ', style: T.small),
              TextSpan(text: '• ${c.absent} Absent', style: T.smallStrong.copyWith(color: C.danger)),
            ]))),
            TextButton(onPressed: () => context.push(_markPath(sc.classId, p)), child: const Text('Details ›')),
          ])
        else if (live) ...[
          if (r == null)
            Text('Attendance not marked yet', style: T.body)
          else
            Row(children: [
              Expanded(child: Text('Draft saved • ${c!.total} Recorded', style: T.body)),
              Text('${r.rate.toStringAsFixed(1)}% Present', style: T.smallStrong.copyWith(color: C.primary)),
            ]),
          SizedBox(height: 8.h),
          AppButton(r == null ? 'Mark Attendance' : 'Resume Attendance', icon: Icons.play_circle_outline_rounded, onPressed: () => context.push(_markPath(sc.classId, p))),
        ] else
          Row(children: [
            Expanded(child: Text('${cls?.students ?? 0} Students Enrolled', style: T.body)),
            Text('Starts in ${startsIn ~/ 60}h ${startsIn % 60}m', style: T.small),
          ]),
      ]),
    );
  }
}

class _SlipRow extends StatelessWidget {
  const _SlipRow({required this.sl, required this.s});
  final LeaveSlip sl;
  final OverviewState s;
  @override
  Widget build(BuildContext context) {
    final st = s.studentById(sl.studentId);
    return AppCard(
      margin: EdgeInsets.only(bottom: 8.h), radius: R.lg, padding: EdgeInsets.all(12.r),
      child: Row(children: [
        Avatar(st?.name ?? '?', size: 42), SizedBox(width: 10.w),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(st?.name ?? 'Student', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 6.w),
            Flexible(child: Pill(sl.reason, tone: Tone.warning)),
          ]),
          Text('Roll #${st?.roll ?? ''} • Grade ${s.classById(st?.classId ?? '')?.label ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        TextButton(onPressed: () => context.push(RoutePaths.leaveSlip(sl.id)), style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)), child: const Text('View')),
        FilledButton(
          onPressed: () {
            context.read<OverviewBloc>().add(OverviewLeaveSlipApproved(sl.id));
            toast(context, 'Leave slip approved');
          },
          style: FilledButton.styleFrom(minimumSize: Size(64.w, 44.h), padding: EdgeInsets.symmetric(horizontal: 12.w), backgroundColor: C.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md))),
          child: Text('Approve', style: T.smallStrong.copyWith(color: Colors.white)),
        ),
      ]),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value, this.sub, this.color);
  final String label, value, sub;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(10.r),
        decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 4.w),
            Container(width: 6.r, height: 6.r, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          ]),
          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text.rich(TextSpan(children: [
            TextSpan(text: value, style: T.stat.copyWith(fontSize: 20.sp, color: label == 'Present' ? C.ink : color)),
            TextSpan(text: ' $sub', style: T.small.copyWith(fontSize: 11.sp, color: label == 'Present' ? C.slate : color)),
          ]))),
        ]),
      );
}
