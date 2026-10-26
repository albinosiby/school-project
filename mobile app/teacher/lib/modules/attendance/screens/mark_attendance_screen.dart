import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/models/school_models.dart';
import '../bloc/load_status.dart';
import '../bloc/mark_attendance_bloc.dart';
import '../bloc/mark_attendance_events.dart';
import '../bloc/mark_attendance_states.dart';
import '../models/attendance_models.dart';
import 'widgets/att_widgets.dart';

Color _fg(AttCode c) => switch (c) { AttCode.present => C.successDark, AttCode.absent => C.danger, AttCode.late => C.warningDark, AttCode.excused => C.slate };
Color _bg(AttCode c) => switch (c) { AttCode.present => C.successSoft, AttCode.absent => C.dangerSoft, AttCode.late => C.warningSoft, AttCode.excused => const Color(0xFFE2E8F0) };

/// 1.1.1 Mark Attendance (Figma 1153:14602).
class MarkAttendanceScreen extends StatelessWidget {
  const MarkAttendanceScreen({super.key, this.classId, this.period});
  final String? classId;
  final int? period;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<MarkAttendanceBloc>()..add(MarkAttendanceLoadRequested(classId: classId, period: period)),
        child: const _MarkView(),
      );
}

class _MarkView extends StatefulWidget {
  const _MarkView();
  @override
  State<_MarkView> createState() => _MarkViewState();
}

class _MarkViewState extends State<_MarkView> {
  String q = '';

  void _save(MarkAttendanceState s, bool submit) {
    context.read<MarkAttendanceBloc>().add(MarkAttendanceSaved(submit: submit));
    final c = s.counts;
    toast(context, submit ? 'Attendance submitted • ${c.p + c.l}/${s.marks.length} present' : 'Draft saved locally');
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<MarkAttendanceBloc>().state;
    final bloc = context.read<MarkAttendanceBloc>();
    final loaded = s.status == LoadStatus.loaded;
    final cnt = s.counts;
    return DetailScaffold(
      title: 'Mark Attendance',
      fallbackRoute: RoutePaths.attendanceHistory,
      actions: [
        IconButton(tooltip: 'Attendance overview', onPressed: () => context.push(RoutePaths.attendanceHistory), icon: Icon(Icons.dashboard_outlined, color: C.ink, size: 24.r)),
      ],
      bottom: !loaded
          ? null
          : Row(children: [
              Expanded(flex: 4, child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(s.saved ? (s.submitted ? 'Submitted • editable' : 'Saved locally • Offline safe') : 'Not saved yet', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('${cnt.p + cnt.l}/${s.marks.length} Present', style: T.bodyStrong, maxLines: 1),
              ])),
              SizedBox(width: 8.w),
              Expanded(flex: 3, child: AppButton('Save Draft', kind: BtnKind.outline, onPressed: s.marks.isEmpty ? null : () => _save(s, false))),
              SizedBox(width: 8.w),
              Expanded(flex: 4, child: AppButton(s.submitted ? 'Update' : 'Submit Attendance', onPressed: s.marks.isEmpty ? null : () => _save(s, true))),
            ]),
      body: !loaded
          ? attLoading()
          : AttBody(children: [
              const AttTabs(0),
              SizedBox(height: 12.h),
              _StaffCard(log: s.staffToday, empId: s.empId),
              SizedBox(height: 12.h),
              _SessionCard(s: s),
              SizedBox(height: 12.h),
              Row(children: [
                Expanded(child: AppButton('Mark All Present', icon: Icons.done_all_rounded, kind: BtnKind.outline, small: true, onPressed: () => bloc.add(const MarkAttendanceAllSet(AttCode.present)))),
                SizedBox(width: 10.w),
                Expanded(child: AppButton('Mark All Absent', icon: Icons.clear_all_rounded, kind: BtnKind.outline, small: true, onPressed: () => bloc.add(const MarkAttendanceAllSet(AttCode.absent)))),
              ]),
              SizedBox(height: 12.h),
              Row(children: [
                for (final c in AttCode.values) ...[
                  if (c != AttCode.present) SizedBox(width: 8.w),
                  Expanded(child: AttCountTile(
                    value: '${switch (c) { AttCode.present => cnt.p, AttCode.absent => cnt.a, AttCode.late => cnt.l, AttCode.excused => cnt.e }}',
                    label: c.label,
                    tone: switch (c) { AttCode.present => Tone.success, AttCode.absent => Tone.danger, AttCode.late => Tone.warning, AttCode.excused => Tone.neutral },
                  )),
                ],
              ]),
              for (final st in s.streak) ...[SizedBox(height: 12.h), _StreakAlert(st: st, sent: s.notified.contains(st.id))],
              SizedBox(height: 12.h),
              AppSearchField(hint: 'Search student name or roll no...', onChanged: (v) => setState(() => q = v)),
              SizedBox(height: 10.h),
              ..._rows(s),
            ]),
    );
  }

  List<Widget> _rows(MarkAttendanceState s) {
    final query = q.trim().toLowerCase();
    final shown = s.roster.where((st) => query.isEmpty || st.name.toLowerCase().contains(query) || '${st.roll}'.contains(query)).toList();
    if (shown.isEmpty) return [const AppEmptyState('No students found', hint: 'Try a different name or roll number.', icon: Icons.person_search_outlined)];
    return [
      for (final st in shown)
        _StudentRow(
          st: st, code: s.marks[st.id] ?? AttCode.present, rate: s.rateOf(st.id),
          onSet: (c) => context.read<MarkAttendanceBloc>().add(MarkAttendanceCodeSet(st.id, c)),
        ),
    ];
  }
}

class _StaffCard extends StatelessWidget {
  const _StaffCard({required this.log, required this.empId});
  final StaffLog? log;
  final String empId;
  @override
  Widget build(BuildContext context) {
    final inT = log?.inTime;
    final onTime = inT != null && mins(inT) <= mins('08:30');
    return AppCard(
      radius: R.lg,
      child: Column(children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(Icons.location_on_outlined, tone: Tone.success, size: 44),
          SizedBox(width: 12.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('STAFF CHECK-IN • $empId', style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(inT == null ? 'Not punched in' : '${t12(inT)} • ${onTime ? 'On-Time' : 'Late'}', style: T.h2),
          ])),
          if (inT != null) ...[SizedBox(width: 6.w), const Flexible(child: Pill('Geofence Verified', tone: Tone.success, icon: Icons.verified_outlined))],
        ]),
        Divider(height: 20.h),
        Row(children: [
          Icon(Icons.schedule_rounded, size: 16.r, color: C.slate), SizedBox(width: 6.w),
          Expanded(child: Text('Shift: 08:00 AM – 04:30 PM', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
          TextButton(
            onPressed: () => context.push(RoutePaths.attendanceSelfLog),
            style: TextButton.styleFrom(minimumSize: Size(44.w, 44.h)),
            child: Text('View Logs ›', style: T.smallStrong.copyWith(color: C.primary)),
          ),
        ]),
      ]),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.s});
  final MarkAttendanceState s;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<MarkAttendanceBloc>();
    final cls = s.cls;
    final closesM = mins(periodTimes[s.period]!.$2) + 20;
    final today = s.date == dkey(todayDate());
    final now = DateTime.now().hour * 60 + DateTime.now().minute;
    final left = closesM - now;
    final closes = !today
        ? 'Late entry for ${fmtKey(s.date, 'd MMM')} • closed at ${t12(hm(closesM))}'
        : left > 0
            ? 'Submission closes in ${left >= 60 ? '${left ~/ 60}h ${left % 60}m' : '$left mins'} (${t12(hm(closesM))})'
            : 'Submission window closed at ${t12(hm(closesM))} • late entry';
    return PanelCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(child: Container(
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
            decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
            child: Text(cls == null ? 'Class' : 'Grade ${cls.label}', style: T.smallStrong.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
          )),
          SizedBox(width: 8.w),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
            decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: C.border)),
            child: Text(cls?.room ?? '', style: T.small),
          ),
          const Spacer(),
          IconButton.outlined(
            tooltip: 'Change class',
            constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
            onPressed: () async {
              final r = await showPickSheet<SchoolClass>(context, title: 'Select class', items: s.classes, label: (c) => c.title, sub: (c) => '${c.subject} • ${c.room}', selected: cls);
              if (r != null) bloc.add(MarkAttendanceClassChanged(r.id));
            },
            icon: Icon(Icons.swap_horiz_rounded, color: C.primary, size: 22.r),
          ),
        ]),
        SizedBox(height: 10.h),
        Text(cls?.subject ?? '', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
        Text('Period ${s.period} • ${periodRange(s.period)} (${s.roster.length} Registered)', style: T.body),
        SizedBox(height: 12.h),
        Row(children: [
          Expanded(child: AppPickTile(
            icon: Icons.calendar_today_rounded, caption: 'Date',
            label: today ? 'Today, ${fmtKey(s.date, 'd MMM')}' : fmtKey(s.date, 'EEE, d MMM'),
            onTap: () async {
              final d = await pickDate(context, s.date, last: todayDate());
              if (d != null) bloc.add(MarkAttendanceDateChanged(d));
            },
          )),
          SizedBox(width: 10.w),
          Expanded(child: AppPickTile(
            icon: Icons.timer_outlined, caption: 'Session', label: 'Period ${s.period}',
            onTap: () async {
              final p = await showPickSheet<int>(context, title: 'Select session', items: periodTimes.keys.toList(), label: (p) => 'Period $p', sub: periodRange, selected: s.period);
              if (p != null) bloc.add(MarkAttendancePeriodChanged(p));
            },
          )),
        ]),
        SizedBox(height: 12.h),
        AttBanner(icon: Icons.alarm_rounded, text: closes),
      ]),
    );
  }
}

class _StreakAlert extends StatelessWidget {
  const _StreakAlert({required this.st, required this.sent});
  final Student st;
  final bool sent;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(14.r),
        decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.warning.withValues(alpha: .4))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(Icons.warning_amber_rounded, tone: Tone.warning, size: 36),
          SizedBox(width: 10.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8.w, runSpacing: 4.h, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text('Consecutive Absence Alert', style: T.bodyStrong),
              Pill(sent ? 'SMS Sent' : 'SMS Pending', tone: sent ? Tone.success : Tone.warning),
            ]),
            SizedBox(height: 4.h),
            Text(
              '${st.name} (Roll ${two(st.roll)}) has missed 3 consecutive school days. ${sent ? 'An automated welfare SMS was dispatched to parent.' : 'Send a welfare SMS to the parent.'}',
              style: T.body.copyWith(color: C.warningDark, fontSize: 13.sp),
            ),
            if (!sent)
              TextButton(
                onPressed: () {
                  context.read<MarkAttendanceBloc>().add(MarkAttendanceWelfareSmsSent(st));
                  toast(context, 'Welfare SMS sent to ${st.guardian}');
                },
                child: const Text('Send welfare SMS'),
              ),
          ])),
        ]),
      );
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.st, required this.code, required this.rate, required this.onSet});
  final Student st;
  final AttCode code;
  final double rate;
  final ValueChanged<AttCode> onSet;
  @override
  Widget build(BuildContext context) {
    final sub = switch (code) {
      AttCode.excused => 'Excused • Leave / medical approved',
      AttCode.late => 'Late Entry • Overall ${rate.round()}%',
      _ => 'Overall: ${rate.round()}% Rate${rate < 75 ? ' • At risk' : ''}',
    };
    return Container(
      margin: EdgeInsets.only(bottom: 10.h), padding: EdgeInsets.all(12.r),
      decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: code == AttCode.absent ? C.danger.withValues(alpha: .35) : C.border)),
      child: Column(children: [
        Row(children: [
          Text(two(st.roll), style: T.smallStrong.copyWith(color: C.muted)),
          SizedBox(width: 10.w),
          Avatar(st.name, size: 38),
          SizedBox(width: 10.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(st.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(sub, style: T.small.copyWith(color: rate < 75 && code == AttCode.present ? C.danger : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
        ]),
        SizedBox(height: 10.h),
        Row(children: [
          for (final c in AttCode.values) ...[
            if (c != AttCode.present) SizedBox(width: 6.w),
            Expanded(
              child: Semantics(
                button: true, selected: c == code, label: '${st.name} ${c.label}',
                child: InkWell(
                  borderRadius: BorderRadius.circular(R.sm),
                  onTap: () => onSet(c),
                  child: Container(
                    constraints: BoxConstraints(minHeight: 44.h), alignment: Alignment.center,
                    decoration: BoxDecoration(color: c == code ? _bg(c) : C.surface, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: c == code ? _fg(c) : C.border)),
                    child: FittedBox(fit: BoxFit.scaleDown, child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4.w),
                      child: Text(c.label, style: T.smallStrong.copyWith(color: c == code ? _fg(c) : C.slate)),
                    )),
                  ),
                ),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}
