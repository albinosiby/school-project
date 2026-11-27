import 'package:flutter/material.dart';
import '../../home/models/timetable_models.dart' show attendanceFlagsFrom, schoolWorkingDays;
import '../../home/screens/widgets/timetable_date_sheet.dart';
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

Color _fg(AttCode c) => switch (c) {
  AttCode.present => C.successDark,
  AttCode.absent => C.danger,
  AttCode.late => C.warningDark,
  AttCode.excused => C.slate,
};
Color _bg(AttCode c) => switch (c) {
  AttCode.present => C.successSoft,
  AttCode.absent => C.dangerSoft,
  AttCode.late => C.warningSoft,
  AttCode.excused => const Color(0xFFE2E8F0),
};

/// 1.1.1 Mark Attendance (Figma 1153:14602).
class MarkAttendanceScreen extends StatelessWidget {
  const MarkAttendanceScreen({super.key, this.classId, this.period, this.date});
  final String? classId;
  final int? period;
  final String? date;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<MarkAttendanceBloc>()..add(MarkAttendanceLoadRequested(classId: classId, period: period, date: date)),
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
  /// Tapping a count chip narrows the roster to that status; tapping it again shows everyone.
  AttCode? filter;

  void _save(MarkAttendanceState s, bool submit) => context.read<MarkAttendanceBloc>().add(MarkAttendanceSaved(submit: submit));

  @override
  Widget build(BuildContext context) => BlocListener<MarkAttendanceBloc, MarkAttendanceState>(
        // the save outcome is announced from the bloc result, not from the tap: a refused save shows its reason
        listenWhen: (a, b) => a.saveError != b.saveError || a.existing?.updatedAt != b.existing?.updatedAt,
        listener: (context, s) {
          if (s.saveError != null) {
            toast(context, s.saveError!);
          } else if (s.saved) {
            final c = s.counts;
            toast(context, s.submitted ? 'Attendance submitted • ${c.p + c.l}/${s.marks.length} present' : 'Draft saved • not submitted yet');
          }
        },
        child: _body(context),
      );

  Widget _body(BuildContext context) {
    final s = context.watch<MarkAttendanceBloc>().state;
    final bloc = context.read<MarkAttendanceBloc>();
    final loaded = s.status == LoadStatus.loaded;
    if (periodTimes.isEmpty || (loaded && s.classes.isEmpty)) {
      return DetailScaffold(title: 'Mark Attendance', fallbackRoute: RoutePaths.attendanceHistory,
        body: AppEmptyState(periodTimes.isEmpty ? 'School timings not configured' : 'No class assigned',
          hint: 'Ask the school office to review the timetable and your class assignments.'));
    }
    if (s.existing?.readOnly == true) {
      return DetailScaffold(title: 'Recorded attendance', fallbackRoute: RoutePaths.attendanceHistory,
        body: const AppEmptyState('Attendance already recorded', hint: 'Another teacher recorded this period. Contact the school office for corrections.'));
    }

    final cnt = s.counts;
    return DetailScaffold(
      title: 'Mark Attendance',
      fallbackRoute: RoutePaths.attendanceHistory,
      actions: [
        IconButton(
          tooltip: 'Attendance overview',
          onPressed: () => context.push(RoutePaths.attendanceHistory),
          icon: Icon(Icons.dashboard_outlined, color: C.ink, size: 24.r),
        ),
      ],
      bottom: !loaded
          ? null
          : Row(
              children: [
                Expanded(
                  flex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        s.saved ? (s.submitted ? (s.dirty ? 'Submitted • unsaved changes' : 'Submitted • no changes') : 'Draft saved • submit to count') : 'Not saved yet',
                        style: T.small,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text('${cnt.p + cnt.l}/${s.marks.length} Present', style: T.bodyStrong, maxLines: 1),
                    ],
                  ),
                ),
                SizedBox(width: 8.w),
                Expanded(
                  flex: 3,
                  child: AppButton('Save Draft', kind: BtnKind.outline, small: true, onPressed: s.marks.isEmpty || !s.dirty ? null : () => _save(s, false)),
                ),
                SizedBox(width: 8.w),
                Expanded(
                  flex: 4,
                  child: AppButton(s.submitted ? 'Update' : 'Submit', small: true, onPressed: s.marks.isEmpty || (s.saved && !s.dirty) ? null : () => _save(s, true)),
                ),
              ],
            ),
      body: !loaded
          ? attLoading()
          : AttBody(
              children: [
                const AttTabs(0),
                SizedBox(height: 12.h),
                _SessionCard(s: s),
                SizedBox(height: 12.h),
                _CountChips(counts: cnt, total: s.marks.length, filter: filter, onFilter: (c) => setState(() => filter = filter == c ? null : c)),
                SizedBox(height: 10.h),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        'Mark All Present',
                        icon: Icons.done_all_rounded,
                        kind: BtnKind.outline,
                        small: true,
                        onPressed: () => bloc.add(const MarkAttendanceAllSet(AttCode.present)),
                      ),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(
                      child: AppButton(
                        'Mark All Absent',
                        icon: Icons.clear_all_rounded,
                        kind: BtnKind.outline,
                        small: true,
                        onPressed: () => bloc.add(const MarkAttendanceAllSet(AttCode.absent)),
                      ),
                    ),
                  ],
                ),
                for (final st in s.streak) ...[SizedBox(height: 12.h), _StreakAlert(st: st, sent: s.notified.contains(st.id))],
                SizedBox(height: 12.h),
                AppSearchField(hint: 'Search student name or roll no...', onChanged: (v) => setState(() => q = v)),
                SizedBox(height: 10.h),
                ..._rows(s),
              ],
            ),
    );
  }

  List<Widget> _rows(MarkAttendanceState s) {
    final query = q.trim().toLowerCase();
    final shown = s.roster
        .where((st) => query.isEmpty || st.name.toLowerCase().contains(query) || '${st.roll}'.contains(query))
        .where((st) => filter == null || (s.marks[st.id] ?? AttCode.present) == filter)
        .toList();
    if (shown.isEmpty) {
      return [
        AppEmptyState(
          filter == null ? 'No students found' : 'No one marked ${filter!.label.toLowerCase()}',
          hint: filter == null ? 'Try a different name or roll number.' : 'Tap the ${filter!.label} chip again to see everyone.',
          icon: Icons.person_search_outlined,
        ),
      ];
    }
    return [
      for (final st in shown)
        _StudentRow(
          st: st,
          code: s.marks[st.id] ?? AttCode.present,
          rate: s.rateOf(st.id),
          onSet: (c) => context.read<MarkAttendanceBloc>().add(MarkAttendanceCodeSet(st.id, c)),
        ),
    ];
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.s});
  final MarkAttendanceState s;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<MarkAttendanceBloc>();
    final cls = s.cls;
    final today = s.date == dkey(todayDate());
    return PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Flexible(
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.pill)),
                  child: Text(
                    cls == null ? 'Class' : 'Grade ${cls.label}',
                    style: T.smallStrong.copyWith(color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              SizedBox(width: 8.w),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                decoration: BoxDecoration(
                  color: C.bg,
                  borderRadius: BorderRadius.circular(R.pill),
                  border: Border.all(color: C.border),
                ),
                child: Text(cls?.room ?? '', style: T.small),
              ),
              const Spacer(),
              IconButton.outlined(
                tooltip: 'Change class',
                constraints: BoxConstraints(minWidth: 44.r, minHeight: 44.r),
                onPressed: () async {
                  final r = await showPickSheet<SchoolClass>(
                    context,
                    title: 'Select class',
                    items: s.classes,
                    label: (c) => c.title,
                    sub: (c) => '${c.subject} • ${c.room}',
                    selected: cls,
                  );
                  if (r != null) bloc.add(MarkAttendanceClassChanged(r.id));
                },
                icon: Icon(Icons.swap_horiz_rounded, color: C.primary, size: 22.r),
              ),
            ],
          ),
          SizedBox(height: 10.h),
          Text(cls?.subject ?? '', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('Period ${s.period} • ${periodRange(s.period)} • ${s.roster.length} students', style: T.body),
          SizedBox(height: 12.h),
          Row(
            children: [
              Expanded(
                child: AppPickTile(
                  icon: Icons.calendar_today_rounded,
                  caption: 'Date',
                  label: today ? 'Today, ${fmtKey(s.date, 'd MMM')}' : fmtKey(s.date, 'EEE, d MMM'),
                  onTap: () async {
                    final now = schoolClockNow();
                    final flags = attendanceFlagsFrom(now);
                    List<int> missed(DateTime d) => s.missingOn(dkey(d), now: now, flagsFrom: flags, workingDays: schoolWorkingDays);
                    final pick = await showTimetableDateSheet(
                      context,
                      title: 'Attendance date',
                      from: DateTime.tryParse(s.date) ?? todayDate(),
                      today: todayDate(),
                      last: todayDate(),
                      allowRange: false,
                      missing: (d) => missed(d).isNotEmpty,
                      missingLabel: 'Your period here not marked',
                    );
                    if (pick == null) return;
                    final day = dkey(pick.from);
                    bloc.add(MarkAttendanceDateChanged(day));
                    // jump to the first period still to mark that day
                    final todo = missed(pick.from);
                    if (todo.isNotEmpty && !todo.contains(s.period)) bloc.add(MarkAttendancePeriodChanged(todo.first));
                  },
                ),
              ),
              SizedBox(width: 10.w),
              Expanded(
                child: AppPickTile(
                  icon: Icons.timer_outlined,
                  caption: 'Session',
                  label: 'Period ${s.period}',
                  onTap: () async {
                    final p = await showPickSheet<int>(
                      context,
                      title: 'Select session',
                      items: periodTimes.keys.toList(),
                      label: (p) => 'Period $p',
                      sub: periodRange,
                      selected: s.period,
                    );
                    if (p != null) bloc.add(MarkAttendancePeriodChanged(p));
                  },
                ),
              ),
            ],
          ),
        ],
      ),
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
    decoration: BoxDecoration(
      color: C.warningSoft,
      borderRadius: BorderRadius.circular(R.lg),
      border: Border.all(color: C.warning.withValues(alpha: .4)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconTile(Icons.warning_amber_rounded, tone: Tone.warning, size: 36),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8.w,
                runSpacing: 4.h,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('Consecutive Absence Alert', style: T.bodyStrong),
                  Pill(sent ? 'SMS Sent' : 'SMS Pending', tone: sent ? Tone.success : Tone.warning),
                ],
              ),
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
            ],
          ),
        ),
      ],
    ),
  );
}

/// Present / Absent / Late / Excused counts as chips; a chip narrows the roster to that status.
class _CountChips extends StatelessWidget {
  const _CountChips({required this.counts, required this.total, required this.filter, required this.onFilter});
  final ({int p, int a, int l, int e}) counts;
  final int total;
  final AttCode? filter;
  final ValueChanged<AttCode> onFilter;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (final c in AttCode.values) ...[
        if (c != AttCode.present) SizedBox(width: 6.w),
        Expanded(
          child: Semantics(
            button: true,
            selected: filter == c,
            label: '${c.label} ${_countOf(c)} of $total',
            child: InkWell(
              borderRadius: BorderRadius.circular(R.md),
              onTap: () => onFilter(c),
              child: Container(
                padding: EdgeInsets.symmetric(vertical: 8.h, horizontal: 4.w),
                decoration: BoxDecoration(
                  color: filter == c ? _bg(c) : C.surface,
                  borderRadius: BorderRadius.circular(R.md),
                  border: Border.all(color: filter == c ? _fg(c) : C.border, width: filter == c ? 1.5 : 1),
                ),
                child: Column(
                  children: [
                    Text('${_countOf(c)}', style: T.h2.copyWith(color: _fg(c))),
                    Text(c.label, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    ],
  );
  int _countOf(AttCode c) => switch (c) { AttCode.present => counts.p, AttCode.absent => counts.a, AttCode.late => counts.l, AttCode.excused => counts.e };
}

/// One line per student: roll, name and rate on the left, four letter toggles (P A L E) on the right.
/// Tapping the name flips between Present and Absent, the two marks that cover almost every tap.
class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.st, required this.code, required this.rate, required this.onSet});
  final Student st;
  final AttCode code;
  final double rate;
  final ValueChanged<AttCode> onSet;
  @override
  Widget build(BuildContext context) {
    final atRisk = rate < minimumAttendance;
    final sub = switch (code) {
      AttCode.excused => 'Excused • leave or medical',
      AttCode.late => 'Late entry • ${rate.round()}% overall',
      AttCode.absent => 'Absent today • ${rate.round()}% overall',
      AttCode.present => '${rate.round()}% overall${atRisk ? ' • at risk' : ''}',
    };
    return Container(
      margin: EdgeInsets.only(bottom: 8.h),
      padding: EdgeInsets.fromLTRB(10.w, 8.h, 8.w, 8.h),
      decoration: BoxDecoration(
        color: code == AttCode.present ? C.bg : _bg(code).withValues(alpha: .45),
        borderRadius: BorderRadius.circular(R.lg),
        border: Border.all(color: code == AttCode.present ? C.border : _fg(code).withValues(alpha: .45)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              button: true,
              label: '${st.name}, ${code.label}. Tap to mark ${code == AttCode.present ? 'absent' : 'present'}',
              child: InkWell(
                borderRadius: BorderRadius.circular(R.md),
                onTap: () => onSet(code == AttCode.present ? AttCode.absent : AttCode.present),
                child: Row(
                  children: [
                    Container(
                      width: 30.r, height: 30.r, alignment: Alignment.center,
                      decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.sm), border: Border.all(color: C.border)),
                      child: Text(st.roll > 0 ? two(st.roll) : '–', style: T.smallStrong.copyWith(color: C.slate, fontSize: 11.sp)),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(st.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(sub, style: T.small.copyWith(fontSize: 11.5.sp, color: atRisk && code == AttCode.present ? C.danger : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(width: 6.w),
          for (final c in AttCode.values) ...[
            if (c != AttCode.present) SizedBox(width: 4.w),
            Semantics(
              button: true,
              selected: c == code,
              label: '${st.name} ${c.label}',
              child: InkWell(
                borderRadius: BorderRadius.circular(R.pill),
                onTap: () => onSet(c),
                child: Container(
                  width: 36.r, height: 36.r, alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: c == code ? _fg(c) : C.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: c == code ? _fg(c) : C.border),
                  ),
                  child: Text(c.code, style: T.smallStrong.copyWith(color: c == code ? Colors.white : C.slate)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
