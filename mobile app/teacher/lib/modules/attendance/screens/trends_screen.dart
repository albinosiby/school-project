import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/models/school_models.dart';
import '../bloc/load_status.dart';
import '../bloc/trends_bloc.dart';
import '../bloc/trends_events.dart';
import '../bloc/trends_states.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';
import 'widgets/notify_parent_sheet.dart';
import 'widgets/student_log_sheet.dart';

const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const _fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/// 1.1.2 Attendance Trends (Figma 1153:15078) with View Log and Notify Parent sheets.
class TrendsScreen extends StatelessWidget {
  const TrendsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(create: (_) => getIt<TrendsBloc>()..add(const TrendsLoadRequested()), child: const _TrendsView());
}

class _TrendsView extends StatelessWidget {
  const _TrendsView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<TrendsBloc>().state;
    final bloc = context.read<TrendsBloc>();
    if (s.status != LoadStatus.loaded) return DetailScaffold(title: 'Attendance Trends', fallbackRoute: RoutePaths.attendanceHistory, body: attLoading());
    final cls = s.cls;
    final recs = s.records;
    final avg = s.avg;
    final rates = s.rates;
    final atRisk = s.atRisk;
    final wk = s.weekdays;
    final ext = s.extremes;
    return DetailScaffold(
      title: 'Attendance Trends',
      fallbackRoute: RoutePaths.attendanceHistory,
      body: AttBody(children: [
        const AttTabs(1),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(children: [
          Row(children: [
            Expanded(flex: 3, child: AppPickTile(
              icon: Icons.groups_rounded, plainIcon: true, label: cls?.title ?? 'Class',
              onTap: () async {
                final r = await showPickSheet<SchoolClass>(context, title: 'Select class', items: s.classes, label: (c) => c.title, selected: cls);
                if (r != null) bloc.add(TrendsClassChanged(r.id));
              },
            )),
            SizedBox(width: 8.w),
            Expanded(flex: 2, child: Container(
              constraints: BoxConstraints(minHeight: 56.h), alignment: Alignment.center, padding: EdgeInsets.symmetric(horizontal: 6.w),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.panelBorder)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.calendar_today_rounded, size: 14.r, color: C.primary), SizedBox(width: 4.w),
                Flexible(child: Text(
                  recs.isEmpty ? 'No data' : '${fmtKey(recs.first.date, 'MMM dd')} – ${fmtKey(recs.last.date, 'dd, yyyy')}',
                  style: T.smallStrong, textAlign: TextAlign.center, maxLines: 2,
                )),
              ]),
            )),
          ]),
          SizedBox(height: 12.h),
          Align(alignment: Alignment.centerLeft, child: AppChoiceChips(items: trendRanges, value: s.range, solid: true, check: true, onChanged: (r) => bloc.add(TrendsRangeChanged(r)))),
        ])),
        SizedBox(height: 12.h),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: StatTile(label: 'Avg Rate', value: '${avg.toStringAsFixed(1)}%', icon: Icons.pie_chart_outline_rounded, badge: avg >= trendTarget ? '≥90%' : '<90%', tone: avg >= trendTarget ? Tone.success : Tone.warning)),
          SizedBox(width: 8.w),
          Expanded(child: StatTile(label: 'At Risk', value: '${atRisk.length}', icon: Icons.warning_amber_rounded, badge: '<75%', tone: Tone.danger)),
          SizedBox(width: 8.w),
          Expanded(child: StatTile(label: 'Perfect', value: '${s.perfect}', icon: Icons.verified_outlined, badge: '100%')),
        ]),
        SizedBox(height: 12.h),
        AppCard(radius: R.xl, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Daily Attendance Trend', style: T.h3), Text('Class average relative to school benchmark', style: T.small),
            ])),
            IconTile(Icons.bar_chart_rounded, size: 36),
          ]),
          SizedBox(height: 14.h),
          Row(children: [
            Expanded(child: Text('Weekly Turnout', style: T.smallStrong)),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
              child: Text('- - 90% School Target', style: T.small.copyWith(color: C.primary, fontSize: 11.sp)),
            ),
          ]),
          SizedBox(height: 8.h),
          if (ext.lo == null)
            const AppEmptyState('No attendance data', hint: 'No records for this class in the selected range.', icon: Icons.bar_chart_rounded)
          else
            AppBarChart(values: wk, labels: _days, min: 80, max: 100, target: trendTarget, lowIndex: ext.lo, highIndex: ext.hi),
          SizedBox(height: 10.h),
          const AppChartLegend(items: [AppLegendItem('Present Rate', C.primary), AppLegendItem('School Target (90%)', C.primary, dashed: true)]),
        ])),
        if (ext.lo != null && ext.hi != null) ...[
          SizedBox(height: 12.h),
          IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: _Insight(title: '${_fullDays[ext.lo!]} Dip', value: '${wk[ext.lo!]!.toStringAsFixed(1)}%', text: 'Lowest weekly attendance recorded.', tip: 'Action Tip', tipText: 'Automate 8 AM parent SMS reminders.', tone: Tone.danger)),
            SizedBox(width: 10.w),
            Expanded(child: _Insight(title: '${_fullDays[ext.hi!]} Peak', value: '${wk[ext.hi!]!.toStringAsFixed(1)}%', text: 'Highest attendance this ${s.range == 'This Week' ? 'week' : s.range == 'This Month' ? 'month' : 'period'}.', tip: 'Key Factor', tipText: 'Practical lab schedules drive high turnout.', tone: Tone.success)),
          ])),
        ],
        SectionHeader('Students Needing Attention', action: 'Export List', onAction: () {
          toast(context, atRisk.isEmpty ? 'No at-risk students to export' : 'List of ${atRisk.length} students exported (simulated)');
        }),
        if (atRisk.isEmpty) const AppCard(child: AppEmptyState('All clear', hint: 'No students are below the 75% threshold.', icon: Icons.verified_outlined)),
        for (final st in atRisk.take(8)) _RiskCard(st: st, rate: rates[st.id]!, s: s),
        SizedBox(height: 12.h),
        AppCard(
          color: C.panel, border: C.panelBorder,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Monthly Attendance Report', style: T.h3),
            Text('Grade ${cls?.label ?? ''} • ${s.range} data', style: T.small),
            SizedBox(height: 12.h),
            AppButton('Download Report (PDF / Excel)', icon: Icons.download_rounded, onPressed: () => toast(context, 'Report for ${cls?.title ?? 'class'} downloaded (simulated)')),
          ]),
        ),
      ]),
    );
  }
}

class _Insight extends StatelessWidget {
  const _Insight({required this.title, required this.value, required this.text, required this.tip, required this.tipText, required this.tone});
  final String title, value, text, tip, tipText;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final c = toneColors(tone);
    return AppCard(
      radius: R.lg, padding: EdgeInsets.all(12.r),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: T.smallStrong.copyWith(color: c.fg)),
        Text(value, style: T.stat),
        Text(text, style: T.small),
        const Spacer(),
        SizedBox(height: 8.h),
        Container(
          width: double.infinity, padding: EdgeInsets.all(8.r), decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(R.sm)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tip, style: T.smallStrong.copyWith(color: c.fg, fontSize: 11.sp)), Text(tipText, style: T.small.copyWith(color: c.fg, fontSize: 11.5.sp)),
          ]),
        ),
      ]),
    );
  }
}

class _RiskCard extends StatelessWidget {
  const _RiskCard({required this.st, required this.rate, required this.s});
  final Student st;
  final double rate;
  final TrendsState s;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<TrendsBloc>();
    final recs = s.records;
    final absents = [for (final r in recs.reversed) if (r.codeOf(st.id) == AttCode.absent) r];
    final mondays = absents.where((r) => DateTime.parse(r.date).weekday == DateTime.monday).length;
    final monPattern = mondays >= 3 && mondays * 2 >= absents.length;
    final medical = s.pendingMedical.contains(st.id);
    final pattern = medical
        ? 'Medical certificate submitted online'
        : absents.isEmpty
            ? 'No absences recorded'
            : monPattern
                ? 'Recurring pattern on Mon mornings'
                : 'Last absent: ${fmtKey(absents.first.date, 'EEEE (MMM d)')}';
    final tag = medical ? ('Review', Tone.brand) : monPattern ? ('Mon Alert', Tone.warning) : ('Unexcused', Tone.danger);
    Future<void> notify() async {
      final n = await showNotifySheet(context, st, cls: s.cls, absentCount: absents.length, mondays: mondays);
      if (n != null) bloc.add(TrendsNoticeSent(n));
    }

    return Container(
      margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.all(14.r),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.xl), border: Border.all(color: C.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(st.name, size: 42, tone: Tone.danger),
          SizedBox(width: 10.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(st.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('Roll No. ${two(st.roll)} • Grade ${s.cls?.label ?? ''}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          Pill('${rate.round()}% Present', tone: Tone.danger),
        ]),
        SizedBox(height: 8.h),
        Row(children: [
          Expanded(child: Text(pattern, style: T.body.copyWith(fontSize: 13.sp))),
          Pill(tag.$1, tone: tag.$2),
        ]),
        SizedBox(height: 10.h),
        Row(children: [
          Expanded(child: AppButton('Call Parent', icon: Icons.call_outlined, kind: BtnKind.outline, small: true, onPressed: () {
            bloc.add(TrendsNoticeSent(ParentNotice(
              studentId: st.id, classId: st.classId, channels: const ['Call'], message: 'Phone call placed to ${st.guardian} (${st.phone})', at: DateTime.now().toIso8601String(),
            )));
            toast(context, 'Calling ${st.guardian} • ${st.phone}');
          })),
          SizedBox(width: 8.w),
          Expanded(child: AppButton(
            medical ? 'View Medical Slips' : 'Notify Parent',
            icon: medical ? Icons.medical_services_outlined : Icons.notifications_active_outlined, kind: BtnKind.soft, small: true,
            onPressed: () => medical ? context.push(Uri(path: RoutePaths.medicalSlips, queryParameters: {'student': st.id}).toString()) : notify(),
          )),
        ]),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => showStudentLog(context, st: st, cls: s.cls, records: recs, onMessage: notify),
            icon: Icon(Icons.history_rounded, size: 18.r),
            label: const Text('View Log'),
          ),
        ),
      ]),
    );
  }
}
