import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../attendance/models/attendance_models.dart';
import '../../school/bloc/school_bloc.dart';
import '../../school/models/school_models.dart';
import '../bloc/class_management_bloc.dart';
import '../bloc/class_management_events.dart';
import '../bloc/class_management_states.dart';
import 'widgets/class_charts.dart';

enum _Tab { overview, students, attendance, leaves }

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
String _dm(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : '${d.day} ${_mon[d.month - 1]}';
}

String _wdm(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : '${_wd[d.weekday - 1]}, ${d.day} ${_mon[d.month - 1]}';
}

/// Class management (class teacher only, opened from the Classes tab): overall performance with charts, every
/// student's attendance and marks, the attendance history, and leave requests to approve.
class ClassManagementScreen extends StatelessWidget {
  const ClassManagementScreen({super.key, required this.classId, this.tab});
  final String classId;

  /// Opening tab: overview (default), students, attendance or leaves.
  final String? tab;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => getIt<ClassManagementBloc>()..add(ClassManagementLoadRequested(classId)),
    child: BlocListener<ClassManagementBloc, ClassManagementState>(
      listenWhen: (a, b) => b.noticeSeq > a.noticeSeq,
      listener: (ctx, s) => AppDialogs.showSnackBar(ctx, message: s.notice ?? ''),
      child: _View(classId: classId, initial: _Tab.values.asNameMap()[tab] ?? _Tab.overview),
    ),
  );
}

class _View extends StatefulWidget {
  const _View({required this.classId, required this.initial});
  final String classId;
  final _Tab initial;
  @override
  State<_View> createState() => _ViewState();
}

class _ViewState extends State<_View> {
  late _Tab _tab = widget.initial;

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final cls = school.classById(widget.classId);
    final s = context.watch<ClassManagementBloc>().state;
    if (cls == null || !cls.classTeacher) {
      return DetailScaffold(
        title: 'Class management',
        fallbackRoute: RoutePaths.classes,
        body: const AppEmptyState('Only the class teacher manages this class', icon: Icons.lock_outline_rounded),
      );
    }
    final pending = s.pendingLeaves.length;
    final labels = {
      _Tab.overview: 'Overview',
      _Tab.students: 'Students',
      _Tab.attendance: 'Attendance',
      _Tab.leaves: pending == 0 ? 'Leaves' : 'Leaves ($pending)',
    };
    return DetailScaffold(
      title: 'Class ${cls.label}',
      subtitle: 'Class management • ${s.roster.length} students',
      fallbackRoute: RoutePaths.classes,
      body: s.status != ClassManagementStatus.loaded
          ? const Padding(padding: EdgeInsets.all(16), child: SchoolSkeletonList())
          : ListView(
              padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 40.h),
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: AppChoiceChips(
                    items: [for (final t in _Tab.values) labels[t]!],
                    value: labels[_tab]!,
                    solid: true,
                    onChanged: (v) => setState(() => _tab = _Tab.values.firstWhere((t) => labels[t] == v)),
                  ),
                ),
                SizedBox(height: 14.h),
                switch (_tab) {
                  _Tab.overview => _Overview(cls: cls, s: s, onTab: (t) => setState(() => _tab = t)),
                  _Tab.students => _Students(cls: cls, s: s),
                  _Tab.attendance => _AttendanceHistory(cls: cls, s: s),
                  _Tab.leaves => _Leaves(s: s),
                },
              ],
            ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, this.sub, required this.child, this.action, this.onAction});
  final String title;
  final String? sub, action;
  final Widget child;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 12.h),
    child: AppCard(
      radius: R.xl,
      padding: EdgeInsets.all(14.r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: T.h3),
                    if (sub != null) Text(sub!, style: T.small.copyWith(fontSize: 11.5.sp)),
                  ],
                ),
              ),
              if (action != null) GestureDetector(onTap: onAction, child: Text(action!, style: T.smallStrong.copyWith(color: C.primary))),
            ],
          ),
          SizedBox(height: 12.h),
          child,
        ],
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

class _Overview extends StatelessWidget {
  const _Overview({required this.cls, required this.s, required this.onTab});
  final SchoolClass cls;
  final ClassManagementState s;
  final ValueChanged<_Tab> onTab;

  @override
  Widget build(BuildContext context) {
    final recent = s.days.length > 30 ? s.days.sublist(s.days.length - 30) : s.days;
    final latest = s.days.isEmpty ? null : s.days.last;
    final marks = s.marksAverage;
    final support = s.needsSupport;
    final top = s.topPerformers;
    final today = dkey(todayDate());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // headline
        Container(
          padding: EdgeInsets.all(16.r),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [C.primary, C.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(R.xl),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('CLASS PERFORMANCE', style: T.small.copyWith(color: Colors.white70, fontSize: 10.5.sp, fontWeight: FontWeight.w700, letterSpacing: .6)),
              SizedBox(height: 12.h),
              Row(
                children: [
                  _Kpi('Attendance', s.days.isEmpty ? '—' : '${s.attendanceRate.toStringAsFixed(1)}%', warn: s.days.isNotEmpty && s.attendanceRate < minimumAttendance),
                  _Kpi('Marks average', marks == null ? '—' : '${marks.toStringAsFixed(1)}%', warn: marks != null && marks < 40),
                  _Kpi('Need support', '${support.length}', warn: support.isNotEmpty),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        _Card(
          title: 'Attendance trend',
          sub: recent.isEmpty ? 'No registers yet' : 'All subjects • last ${recent.length} school days • tap or drag to read a day',
          child: TrendLineChart(
            points: [for (final d in recent) (label: _dm(d.date), value: d.rate)],
            threshold: minimumAttendance,
            detail: (i) => '${_wdm(recent[i].date)} • ${s.markedLabel(recent[i])} • ${recent[i].absentees.length} absent',
          ),
        ),
        if (latest != null)
          _Card(
            title: latest.date == today ? "Today's attendance" : 'Last school day',
            sub: '${_wdm(latest.date)} • ${s.markedLabel(latest)}, counted per period',
            child: DonutChart(
              center: '${latest.rate.round()}%',
              caption: 'present',
              segments: [
                (label: 'Present', value: latest.present, color: C.success),
                (label: 'Late', value: latest.late, color: C.warning),
                (label: 'Absent', value: latest.absent, color: C.danger),
                (label: 'Excused', value: latest.excused, color: C.purple),
              ],
            ),
          ),
        _Card(
          title: 'Subject performance',
          sub: s.scored.isEmpty ? 'No marks entered yet — every subject is listed' : 'Class average of every exam mark',
          child: HBarChart(
            items: [
              for (final e in s.subjectMarks.entries)
                (label: e.key, value: e.value, caption: '${s.scored.where((m) => m.subject == e.key).map((m) => m.cycleId).toSet().length} exams'),
            ],
            threshold: 40,
            empty: 'No marks yet',
          ),
        ),
        if (s.examAverages.length > 1)
          _Card(
            title: 'Progress across exams',
            sub: 'Class average per exam',
            child: TrendLineChart(points: [for (final e in s.examAverages) (label: e.exam, value: e.avg)], threshold: 40, color: C.purple),
          ),
        _Card(
          title: 'Attendance by subject',
          sub: 'All ${s.subjects.length} subjects • average register of each subject\'s periods',
          child: HBarChart(
            items: [
              for (final e in s.subjectAttendance.entries)
                (
                  label: e.key,
                  value: e.value,
                  caption: [
                    if (s.weeklyPeriods(e.key) > 0) '${s.weeklyPeriods(e.key)}/wk',
                    if ((s.subjectRegisters[e.key] ?? 0) > 0) '${s.subjectRegisters[e.key]} reg.',
                  ].join(' • '),
                ),
            ],
            threshold: minimumAttendance,
            color: C.success,
            empty: 'No registers yet',
          ),
        ),
        if (s.scored.isNotEmpty)
          _Card(
            title: 'Marks distribution',
            sub: 'Students by their average',
            child: ColumnChart(
              values: s.marksBands,
              labels: const ['<40', '40–60', '60–75', '75–90', '90+'],
              colors: const [C.danger, C.warning, Color(0xFF60A5FA), C.primary, C.success],
            ),
          ),
        if (top.isNotEmpty)
          _Card(
            title: 'Top performers',
            child: Column(children: [for (final t in top) _StandingRow(t, cls: cls)]),
          ),
        _Card(
          title: 'Needs support',
          sub: 'Attendance under $attendanceThresholdLabel% or marks under 40%',
          action: support.length > 5 ? 'All' : null,
          onAction: () => onTab(_Tab.students),
          child: support.isEmpty
              ? Text('Everyone is on track.', style: T.small.copyWith(color: C.successDark, fontWeight: FontWeight.w600))
              : Column(children: [for (final t in support.take(5)) _StandingRow(t, cls: cls)]),
        ),
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.label, this.value, {this.warn = false});
  final String label, value;
  final bool warn;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: T.title.copyWith(color: warn ? const Color(0xFFFFD6A5) : Colors.white)),
        ),
        Text(label, style: T.small.copyWith(color: Colors.white70, fontSize: 11.sp)),
      ],
    ),
  );
}

/// A student with attendance and marks; opens their progress in this class.
class _StandingRow extends StatelessWidget {
  const _StandingRow(this.t, {required this.cls});
  final StudentStanding t;
  final SchoolClass cls;
  @override
  Widget build(BuildContext context) {
    final st = t.student;
    final lowAtt = t.attendance < minimumAttendance;
    final lowMarks = t.marks != null && t.marks! < 40;
    return InkWell(
      key: ValueKey('standing-${st.id}'),
      onTap: () => context.push(RoutePaths.classStudent(cls.id, st.id)),
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 8.h),
        child: Row(
          children: [
            Avatar(st.name, size: 38, image: st.photo.isEmpty ? null : st.photo),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(st.name, style: T.bodyStrong.copyWith(fontSize: 13.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(st.roll > 0 ? 'Roll ${st.roll.toString().padLeft(2, '0')} • ${t.absences} absent' : '${t.absences} absent', style: T.small.copyWith(fontSize: 11.5.sp)),
                ],
              ),
            ),
            _MiniMetric('Att.', t.attendance, low: lowAtt),
            SizedBox(width: 10.w),
            _MiniMetric('Marks', t.marks, low: lowMarks),
            Icon(Icons.chevron_right_rounded, size: 20.r, color: C.muted),
          ],
        ),
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric(this.label, this.value, {required this.low});
  final String label;
  final double? value;
  final bool low;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 46.w,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(value == null ? '—' : '${value!.round()}%', style: T.bodyStrong.copyWith(fontSize: 13.sp, color: value == null ? C.muted : (low ? C.danger : C.ink))),
        SizedBox(height: 3.h),
        ClipRRect(
          borderRadius: BorderRadius.circular(R.pill),
          child: LinearProgressIndicator(value: ((value ?? 0) / 100).clamp(0, 1), minHeight: 3.h, backgroundColor: C.border, color: low ? C.danger : C.success),
        ),
        Text(label, style: T.small.copyWith(fontSize: 9.5.sp)),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

class _Students extends StatefulWidget {
  const _Students({required this.cls, required this.s});
  final SchoolClass cls;
  final ClassManagementState s;
  @override
  State<_Students> createState() => _StudentsState();
}

class _StudentsState extends State<_Students> {
  static const _sorts = ['Roll', 'Attendance ↑', 'Marks ↑', 'Marks ↓'];
  String _q = '', _sort = 'Roll';

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = [
      for (final t in widget.s.standings)
        if (q.isEmpty || '${t.student.name} ${t.student.roll} ${t.student.adm}'.toLowerCase().contains(q)) t,
    ];
    switch (_sort) {
      case 'Attendance ↑':
        list.sort((a, b) => a.attendance.compareTo(b.attendance));
      case 'Marks ↑':
        list.sort((a, b) => (a.marks ?? 999).compareTo(b.marks ?? 999));
      case 'Marks ↓':
        list.sort((a, b) => (b.marks ?? -1).compareTo(a.marks ?? -1));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSearchField(hint: 'Search name, roll or admission no.', onChanged: (v) => setState(() => _q = v)),
        SizedBox(height: 10.h),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: AppChoiceChips(items: _sorts, value: _sort, dense: true, onChanged: (v) => setState(() => _sort = v)),
        ),
        SizedBox(height: 10.h),
        if (list.isEmpty)
          const AppEmptyState('No one matches', icon: Icons.person_search_outlined)
        else
          AppCard(
            radius: R.xl,
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
            child: Column(
              children: [
                for (var i = 0; i < list.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: C.border),
                  _StandingRow(list[i], cls: widget.cls),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Attendance history
// ---------------------------------------------------------------------------

class _AttendanceHistory extends StatefulWidget {
  const _AttendanceHistory({required this.cls, required this.s});
  final SchoolClass cls;
  final ClassManagementState s;
  @override
  State<_AttendanceHistory> createState() => _AttendanceHistoryState();
}

class _AttendanceHistoryState extends State<_AttendanceHistory> {
  late DateTime _month = () {
    final last = widget.s.days.isEmpty ? null : DateTime.tryParse(widget.s.days.last.date);
    final t = last ?? DateTime.now();
    return DateTime(t.year, t.month);
  }();

  String get _key => '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  void _openDay(BuildContext context, String date) {
    final s = widget.s;
    final regs = [for (final r in s.records) if (r.date == date) r]..sort((a, b) => a.period.compareTo(b.period));
    showAppSheet<void>(
      context,
      title: _wdm(date),
      subtitle: '${regs.length} ${regs.length == 1 ? 'period' : 'periods'} marked',
      builder: (_) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final r in regs) ...[
            Row(
              children: [
                Container(
                  width: 34.r,
                  height: 34.r,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.md)),
                  child: Text('P${r.period}', style: T.smallStrong.copyWith(color: C.primary)),
                ),
                SizedBox(width: 10.w),
                Expanded(child: Text(s.subjectOf(r), style: T.bodyStrong)),
                Text('${r.counts.present + r.counts.late}/${r.total}', style: T.bodyStrong.copyWith(color: r.rate < minimumAttendance ? C.danger : C.successDark)),
              ],
            ),
            Padding(
              padding: EdgeInsets.only(left: 44.w, top: 4.h, bottom: 12.h),
              child: Text(
                () {
                  final absent = [for (final e in r.marks.entries) if (e.value == 'A') s.studentOf(e.key)?.name ?? e.key];
                  final late = [for (final e in r.marks.entries) if (e.value == 'L') s.studentOf(e.key)?.name ?? e.key];
                  return [
                    absent.isEmpty ? 'No one absent' : 'Absent: ${absent.join(', ')}',
                    if (late.isNotEmpty) 'Late: ${late.join(', ')}',
                  ].join('\n');
                }(),
                style: T.small.copyWith(fontSize: 12.sp),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final rates = s.dayRates(_key);
    final lead = DateTime(_month.year, _month.month).weekday - 1;
    final days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final rows = ((lead + days) / 7).ceil();
    final monthAvg = rates.isEmpty ? null : rates.values.reduce((a, b) => a + b) / rates.length;
    final history = s.days.reversed.take(20).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          radius: R.xl,
          padding: EdgeInsets.all(12.r),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Previous month',
                    onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)),
                    icon: Icon(Icons.chevron_left_rounded, size: 22.r),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text('${const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][_month.month - 1]} ${_month.year}', style: T.h3),
                        Text(monthAvg == null ? 'No registers' : '${rates.length} days • average ${monthAvg.toStringAsFixed(1)}%', style: T.small.copyWith(fontSize: 11.sp)),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next month',
                    onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1)),
                    icon: Icon(Icons.chevron_right_rounded, size: 22.r),
                  ),
                ],
              ),
              Row(
                children: [
                  for (final d in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
                    Expanded(child: Center(child: Text(d, style: T.small.copyWith(fontSize: 11.sp, fontWeight: FontWeight.w700)))),
                ],
              ),
              SizedBox(height: 4.h),
              for (var r = 0; r < rows; r++)
                Row(
                  children: [
                    for (var c = 0; c < 7; c++)
                      Expanded(
                        child: Builder(
                          builder: (_) {
                            final n = r * 7 + c - lead + 1;
                            if (n < 1 || n > days) return SizedBox(height: 44.h);
                            final key = '$_key-${n.toString().padLeft(2, '0')}';
                            final rate = rates[key];
                            final color = rate == null
                                ? null
                                : rate >= 95
                                ? C.success
                                : rate >= 85
                                ? const Color(0xFF34D399)
                                : rate >= minimumAttendance
                                ? C.warning
                                : C.danger;
                            return GestureDetector(
                              key: ValueKey('day-$key'),
                              onTap: rate == null ? null : () => _openDay(context, key),
                              child: Container(
                                height: 40.h,
                                margin: EdgeInsets.all(2.r),
                                decoration: BoxDecoration(color: color?.withValues(alpha: .18) ?? Colors.transparent, borderRadius: BorderRadius.circular(R.sm)),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text('$n', style: T.smallStrong.copyWith(fontSize: 12.sp, color: color ?? C.muted)),
                                    if (rate != null) Text('${rate.round()}', style: T.small.copyWith(fontSize: 8.5.sp, color: color)),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              SizedBox(height: 8.h),
              Wrap(
                spacing: 12.w,
                children: [
                  for (final (l, c) in [('95%+', C.success), ('85–95', const Color(0xFF34D399)), ('$attendanceThresholdLabel–85', C.warning), ('Below', C.danger)])
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 9.r, height: 9.r, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2.r))),
                        SizedBox(width: 4.w),
                        Text(l, style: T.small.copyWith(fontSize: 11.sp)),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        _Card(
          title: 'Recent registers',
          sub: 'Tap a day for each period and who was absent',
          child: Column(
            children: [
              if (history.isEmpty) Text('No registers submitted yet.', style: T.small),
              for (final r in history)
                InkWell(
                  onTap: () => _openDay(context, r.date),
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.h),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 104.w,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_wdm(r.date), style: T.bodyStrong.copyWith(fontSize: 13.sp)),
                              Text(s.markedLabel(r), style: T.small.copyWith(fontSize: 10.5.sp, color: s.scheduledOn(r.date) > r.periods ? C.warningDark : C.slate)),
                            ],
                          ),
                        ),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(R.pill),
                            child: LinearProgressIndicator(
                              value: (r.rate / 100).clamp(0, 1),
                              minHeight: 7.h,
                              backgroundColor: C.surface,
                              color: r.rate < minimumAttendance ? C.danger : C.success,
                            ),
                          ),
                        ),
                        SizedBox(width: 10.w),
                        SizedBox(
                          width: 70.w,
                          child: Text('${r.absentees.length} absent', textAlign: TextAlign.right, style: T.small.copyWith(fontSize: 12.sp, color: r.absentees.isNotEmpty ? C.danger : C.slate)),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

class _Leaves extends StatefulWidget {
  const _Leaves({required this.s});
  final ClassManagementState s;
  @override
  State<_Leaves> createState() => _LeavesState();
}

class _LeavesState extends State<_Leaves> {
  bool _decided = false;

  Future<void> _decide(BuildContext context, LeaveSlip l, bool approve) async {
    final bloc = context.read<ClassManagementBloc>();
    final note = await showAppSheet<String>(
      context,
      title: approve ? 'Approve leave' : 'Reject leave',
      subtitle: '${widget.s.studentOf(l.studentId)?.name ?? 'Student'} • ${_range(l)}',
      builder: (_) => _DecisionForm(approve: approve),
    );
    if (note != null) bloc.add(ClassLeaveDecided(l.id, approve: approve, note: note));
  }

  static String _range(LeaveSlip l) {
    final a = DateTime.tryParse(l.from), b = DateTime.tryParse(l.to);
    final days = a == null || b == null ? 1 : b.difference(a).inDays + 1;
    return '${l.from == l.to ? _dm(l.from) : '${_dm(l.from)} – ${_dm(l.to)}'} • $days ${days == 1 ? 'day' : 'days'}';
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final list = _decided ? s.decidedLeaves : s.pendingLeaves;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSegmented(
          items: ['Pending (${s.pendingLeaves.length})', 'Decided (${s.decidedLeaves.length})'],
          value: _decided ? 'Decided (${s.decidedLeaves.length})' : 'Pending (${s.pendingLeaves.length})',
          track: true,
          onChanged: (v) => setState(() => _decided = v.startsWith('Decided')),
        ),
        SizedBox(height: 12.h),
        if (list.isEmpty)
          Padding(
            padding: EdgeInsets.only(top: 20.h),
            child: AppEmptyState(_decided ? 'No decisions yet' : 'No leave requests waiting', icon: Icons.event_available_outlined),
          ),
        for (final l in list)
          Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: AppCard(
              key: ValueKey('leave-${l.id}'),
              radius: R.xl,
              padding: EdgeInsets.all(14.r),
              onTap: () => context.push(RoutePaths.leaveSlip(l.id)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Avatar(s.studentOf(l.studentId)?.name ?? '?', size: 38, image: (s.studentOf(l.studentId)?.photo ?? '').isEmpty ? null : s.studentOf(l.studentId)!.photo),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(s.studentOf(l.studentId)?.name ?? 'Student', style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text('${l.type} • ${_range(l)}', style: T.small.copyWith(fontSize: 12.sp)),
                          ],
                        ),
                      ),
                      if (l.decided) Pill(l.status, tone: l.status == 'Approved' ? Tone.success : Tone.danger),
                    ],
                  ),
                  if (l.reason.isNotEmpty) ...[
                    SizedBox(height: 10.h),
                    Text(l.reason, style: T.body.copyWith(color: C.ink)),
                  ],
                  SizedBox(height: 6.h),
                  Text(
                    [if (l.parent.isNotEmpty) 'From ${l.parent}', if (l.files.isNotEmpty) '${l.files.length} ${l.files.length == 1 ? 'attachment' : 'attachments'}'].join(' • '),
                    style: T.small.copyWith(fontSize: 11.5.sp),
                  ),
                  if (l.decided && (l.decisionNote ?? '').isNotEmpty) ...[
                    SizedBox(height: 6.h),
                    Text('Note: ${l.decisionNote}', style: T.small.copyWith(fontStyle: FontStyle.italic)),
                  ],
                  if (!l.decided) ...[
                    SizedBox(height: 12.h),
                    Row(
                      children: [
                        Expanded(
                          child: AppButton('Reject', key: ValueKey('reject-${l.id}'), small: true, kind: BtnKind.outline, icon: Icons.close_rounded, onPressed: () => _decide(context, l, false)),
                        ),
                        SizedBox(width: 10.w),
                        Expanded(
                          child: AppButton('Approve', key: ValueKey('approve-${l.id}'), small: true, icon: Icons.check_rounded, onPressed: () => _decide(context, l, true)),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Optional note for a leave decision; pops with the note ('' allowed) or null when dismissed.
class _DecisionForm extends StatefulWidget {
  const _DecisionForm({required this.approve});
  final bool approve;
  @override
  State<_DecisionForm> createState() => _DecisionFormState();
}

class _DecisionFormState extends State<_DecisionForm> {
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(
        key: const ValueKey('leave-note'),
        controller: _note,
        maxLines: 3,
        minLines: 2,
        decoration: InputDecoration(labelText: widget.approve ? 'Note to the parent (optional)' : 'Reason (shown to the parent)', isDense: true),
      ),
      SizedBox(height: 14.h),
      AppButton(
        widget.approve ? 'Approve' : 'Reject',
        key: const ValueKey('leave-confirm'),
        icon: widget.approve ? Icons.check_rounded : Icons.close_rounded,
        kind: widget.approve ? BtnKind.primary : BtnKind.danger,
        onPressed: () => Navigator.pop(context, _note.text),
      ),
    ],
  );
}
