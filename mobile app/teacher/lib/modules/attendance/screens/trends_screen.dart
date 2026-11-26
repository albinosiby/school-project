import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
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

const _short = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _plural = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

/// Attendance trends of one class over a range: the average and its change, how marks split, the day-by-day trend,
/// the weekday pattern, and the students to follow up (log, parent message, call).
class TrendsScreen extends StatelessWidget {
  const TrendsScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<TrendsBloc>()..add(const TrendsLoadRequested()), child: const _TrendsView());
}

class _TrendsView extends StatelessWidget {
  const _TrendsView();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<TrendsBloc>().state;
    if (s.status != LoadStatus.loaded) {
      return DetailScaffold(title: 'Attendance Trends', fallbackRoute: RoutePaths.attendanceHistory, body: attLoading());
    }
    final recs = s.records;
    return DetailScaffold(
      title: 'Attendance Trends',
      subtitle: s.cls == null ? null : 'Class ${s.cls!.label}',
      fallbackRoute: RoutePaths.attendanceHistory,
      body: AttBody(
        children: [
          const AttTabs(1),
          SizedBox(height: 12.h),
          _Filters(s),
          SizedBox(height: 12.h),
          if (s.outsideYear > 0) ...[_OutsideYear(s.outsideYear), SizedBox(height: 12.h)],
          if (recs.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24.h),
              child: AppEmptyState(
                'No attendance yet',
                hint: 'Nothing was submitted for ${s.cls == null ? 'this class' : 'Class ${s.cls!.label}'} ${s.range.toLowerCase()}. Try a longer range.',
                icon: Icons.insights_outlined,
              ),
            )
          else ...[
            _Hero(s),
            SizedBox(height: 12.h),
            _TrendCard(s),
            SizedBox(height: 12.h),
            _WeekdayCard(s),
            SizedBox(height: 18.h),
            _Students(s),
          ],
        ],
      ),
    );
  }
}

/// Class picker and range chips.
class _Filters extends StatelessWidget {
  const _Filters(this.s);
  final TrendsState s;
  @override
  Widget build(BuildContext context) {
    final bloc = context.read<TrendsBloc>();
    final cls = s.cls;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppPickTile(
          icon: Icons.groups_rounded,
          plainIcon: true,
          label: cls?.title ?? 'Pick a class',
          caption: cls == null ? null : '${s.roster.length} students',
          onTap: () async {
            final r = await showPickSheet<SchoolClass>(context, title: 'Select class', items: s.classes, label: (c) => c.title, selected: cls);
            if (r != null) bloc.add(TrendsClassChanged(r.id));
          },
        ),
        SizedBox(height: 10.h),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: AppChoiceChips(items: trendRanges, value: s.range, solid: true, dense: true, onChanged: (r) => bloc.add(TrendsRangeChanged(r))),
        ),
      ],
    );
  }
}

class _OutsideYear extends StatelessWidget {
  const _OutsideYear(this.n);
  final int n;
  @override
  Widget build(BuildContext context) => AppCard(
    radius: R.lg,
    color: C.warningSoft,
    border: C.warningSoft,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.event_busy_outlined, color: C.warningDark, size: 20.r),
        SizedBox(width: 10.w),
        Expanded(
          child: Text(
            '$n submitted ${n == 1 ? 'record is' : 'records are'} dated outside the academic year and not counted. '
            'Ask the office to set the term dates in the dashboard (Settings → Academic Year).',
            style: T.small.copyWith(color: C.warningDark),
          ),
        ),
      ],
    ),
  );
}

/// The class average over the range with its change, the days counted and the split of marks.
class _Hero extends StatelessWidget {
  const _Hero(this.s);
  final TrendsState s;

  String get _prevLabel => switch (s.range) {
    'This week' => 'last week',
    'This month' => 'the month before',
    _ => 'the period before',
  };

  @override
  Widget build(BuildContext context) {
    final avg = s.avg;
    final prev = s.previousAvg;
    final delta = prev == null ? null : avg - prev;
    final recs = s.records;
    final t = s.totals;
    final low = avg < minimumAttendance;
    return Container(
      padding: EdgeInsets.all(16.r),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [C.primary, C.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(R.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CLASS AVERAGE • ${s.range.toUpperCase()}', style: T.small.copyWith(color: Colors.white70, fontSize: 10.5.sp, fontWeight: FontWeight.w700, letterSpacing: .5)),
                    SizedBox(height: 4.h),
                    Text('${avg.toStringAsFixed(1)}%', style: T.stat.copyWith(color: Colors.white, fontSize: 34.sp, height: 1.1)),
                    SizedBox(height: 6.h),
                    if (delta != null)
                      _Delta(delta, against: _prevLabel)
                    else
                      Text('Nothing recorded $_prevLabel to compare', style: T.small.copyWith(color: Colors.white70, fontSize: 11.5.sp)),
                  ],
                ),
              ),
              _Ring(avg / 100, low: low),
            ],
          ),
          SizedBox(height: 14.h),
          Text(
            '${recs.length} ${recs.length == 1 ? 'day' : 'days'} recorded • ${fmtKey(recs.first.date, 'd MMM')} – ${fmtKey(recs.last.date, 'd MMM')}'
            ' • minimum $attendanceThresholdLabel%',
            style: T.small.copyWith(color: Colors.white.withValues(alpha: .85), fontSize: 11.5.sp),
          ),
          SizedBox(height: 12.h),
          _SplitBar(t),
        ],
      ),
    );
  }
}

class _Delta extends StatelessWidget {
  const _Delta(this.delta, {required this.against});
  final double delta;
  final String against;
  @override
  Widget build(BuildContext context) {
    final flat = delta.abs() < .05;
    final up = delta > 0;
    return Row(
      children: [
        Container(
          padding: EdgeInsets.symmetric(horizontal: 7.w, vertical: 2.h),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .18), borderRadius: BorderRadius.circular(R.pill)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                flat ? Icons.trending_flat_rounded : (up ? Icons.trending_up_rounded : Icons.trending_down_rounded),
                size: 14.r,
                color: Colors.white,
              ),
              SizedBox(width: 3.w),
              Text(
                flat ? 'Same' : '${up ? '+' : '−'}${delta.abs().toStringAsFixed(1)} pts',
                style: T.smallStrong.copyWith(color: Colors.white, fontSize: 11.5.sp),
              ),
            ],
          ),
        ),
        SizedBox(width: 6.w),
        Flexible(
          child: Text('vs $against', style: T.small.copyWith(color: Colors.white70, fontSize: 11.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring(this.value, {required this.low});
  final double value;
  final bool low;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 64.r,
    height: 64.r,
    child: Stack(
      alignment: Alignment.center,
      children: [
        SizedBox.expand(
          child: CircularProgressIndicator(
            value: value.clamp(0, 1),
            strokeWidth: 7.r,
            strokeCap: StrokeCap.round,
            backgroundColor: Colors.white.withValues(alpha: .2),
            color: low ? const Color(0xFFFFB4AB) : Colors.white,
          ),
        ),
        Icon(low ? Icons.warning_amber_rounded : Icons.how_to_reg_rounded, color: Colors.white, size: 24.r),
      ],
    ),
  );
}

/// Present / late / absent / excused as one stacked bar with counts (student-days).
class _SplitBar extends StatelessWidget {
  const _SplitBar(this.t);
  final AttCounts t;
  @override
  Widget build(BuildContext context) {
    final parts = [
      ('Present', t.present, const Color(0xFFFFFFFF)),
      ('Late', t.late, const Color(0xFFFCD34D)),
      ('Absent', t.absent, const Color(0xFFFFB4AB)),
      ('Excused', t.excused, const Color(0xFFC4B5FD)),
    ];
    final total = t.total == 0 ? 1 : t.total;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(R.pill),
          child: SizedBox(
            height: 8.h,
            child: Row(
              children: [
                for (final p in parts)
                  if (p.$2 > 0) Expanded(flex: (p.$2 * 1000 / total).round().clamp(1, 1000), child: Container(color: p.$3)),
                if (t.total == 0) Expanded(child: Container(color: Colors.white24)),
              ],
            ),
          ),
        ),
        SizedBox(height: 8.h),
        Wrap(
          spacing: 12.w,
          runSpacing: 4.h,
          children: [
            for (final p in parts)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 8.r, height: 8.r, decoration: BoxDecoration(color: p.$3, shape: BoxShape.circle)),
                  SizedBox(width: 4.w),
                  Text('${p.$1} ${p.$2}', style: T.small.copyWith(color: Colors.white, fontSize: 11.sp, fontWeight: FontWeight.w600)),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

/// Every recorded day as a bar in a sideways-scrolling chart (opens on the latest day). The scale and the
/// school-minimum line stay put while the bars scroll; tap a bar for that day's counts.
class _TrendCard extends StatefulWidget {
  const _TrendCard(this.s);
  final TrendsState s;
  @override
  State<_TrendCard> createState() => _TrendCardState();
}

class _TrendCardState extends State<_TrendCard> {
  final _scroll = ScrollController();
  int? _sel;

  @override
  void initState() {
    super.initState();
    _toLatest();
  }

  @override
  void didUpdateWidget(covariant _TrendCard old) {
    super.didUpdateWidget(old);
    if (old.s.range != widget.s.range || old.s.classId != widget.s.classId) {
      _sel = null;
      _toLatest();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _toLatest() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
  });

  static const _wd = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  Widget build(BuildContext context) {
    final pts = widget.s.trend;
    final selIndex = (_sel ?? pts.length - 1).clamp(0, pts.length - 1);
    final sel = pts[selIndex];
    final lowest = pts.map((p) => p.rate).reduce((a, b) => a < b ? a : b);
    final minY = ((lowest.clamp(0, minimumAttendance) - 5) / 10).floor().clamp(0, 9) * 10.0;
    final chartH = 160.h, labelH = 40.h, barW = 30.w;
    double y(double v) => chartH * ((v.clamp(minY, 100) - minY) / (100 - minY));
    final below = sel.rate < minimumAttendance;
    return AppCard(
      radius: R.xl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Daily trend', style: T.h3)),
              Text('${pts.length} days • swipe', style: T.small.copyWith(fontSize: 11.sp)),
              Icon(Icons.swipe_rounded, size: 14.r, color: C.muted),
            ],
          ),
          SizedBox(height: 10.h),
          // the picked day
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            decoration: BoxDecoration(
              color: below ? C.dangerSoft : C.primarySoft,
              borderRadius: BorderRadius.circular(R.lg),
            ),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fmtKey(sel.date, 'EEEE, d MMM'), style: T.smallStrong.copyWith(color: below ? C.danger : C.primary)),
                    SizedBox(height: 2.h),
                    Text('${sel.rate.toStringAsFixed(1)}%', style: T.h2.copyWith(color: below ? C.danger : C.ink)),
                  ],
                ),
                const Spacer(),
                _Count('Present', sel.counts.present, C.successDark),
                _Count('Absent', sel.counts.absent, C.danger),
                _Count('Late', sel.counts.late, C.warningDark),
              ],
            ),
          ),
          SizedBox(height: 14.h),
          SizedBox(
            height: chartH + labelH + 22.h,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // fixed scale
                SizedBox(
                  width: 28.w,
                  child: Padding(
                    padding: EdgeInsets.only(top: 22.h),
                    child: SizedBox(
                      height: chartH,
                      child: Stack(
                        children: [
                          for (final v in [100.0, (100 + minY) / 2, minY])
                            Positioned(
                              right: 0,
                              bottom: y(v) - 6.h,
                              child: Text('${v.round()}', style: T.small.copyWith(fontSize: 9.5.sp, color: C.muted)),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 6.w),
                Expanded(
                  child: Stack(
                    children: [
                      // fixed grid + minimum line behind the bars
                      Positioned(
                        top: 22.h,
                        left: 0,
                        right: 0,
                        height: chartH,
                        child: Stack(
                          children: [
                            for (final v in [100.0, (100 + minY) / 2, minY])
                              Positioned(left: 0, right: 0, bottom: y(v), child: Container(height: 1, color: C.border.withValues(alpha: .7))),
                            Positioned(
                              left: 0,
                              right: 0,
                              bottom: y(minimumAttendance),
                              child: CustomPaint(size: const Size(double.infinity, 1.5), painter: _Dashed()),
                            ),
                          ],
                        ),
                      ),
                      ShaderMask(
                        // soft fade at both edges so the scroll reads
                        shaderCallback: (r) => const LinearGradient(
                          colors: [Colors.transparent, Colors.black, Colors.black, Colors.transparent],
                          stops: [0, .04, .96, 1],
                        ).createShader(r),
                        blendMode: BlendMode.dstIn,
                        child: ListView.builder(
                          controller: _scroll,
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          padding: EdgeInsets.symmetric(horizontal: 6.w),
                          itemCount: pts.length,
                          itemBuilder: (context, i) {
                            final p = pts[i];
                            final d = DateTime.parse(p.date);
                            final on = i == selIndex;
                            final low = p.rate < minimumAttendance;
                            final newMonth = i == 0 || DateTime.parse(pts[i - 1].date).month != d.month;
                            final color = low ? C.danger : C.primary;
                            return Semantics(
                              button: true,
                              selected: on,
                              label: '${fmtKey(p.date, 'EEE d MMM')}, ${p.rate.round()}% present',
                              child: GestureDetector(
                                key: ValueKey('trend-bar-$i'),
                                behavior: HitTestBehavior.opaque,
                                onTap: () => setState(() => _sel = i),
                                child: SizedBox(
                                  width: barW + (newMonth && i > 0 ? 10.w : 0),
                                  child: Row(
                                    children: [
                                      if (newMonth && i > 0)
                                        Container(width: 1, margin: EdgeInsets.only(right: 9.w, top: 22.h), color: C.border),
                                      Expanded(
                                        child: Column(
                                          children: [
                                            // value bubble over the picked bar
                                            SizedBox(
                                              height: 22.h,
                                              child: on
                                                  ? FittedBox(
                                                      child: Container(
                                                        padding: EdgeInsets.symmetric(horizontal: 5.w, vertical: 2.h),
                                                        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(R.sm)),
                                                        child: Text('${p.rate.round()}%', style: T.smallStrong.copyWith(color: Colors.white, fontSize: 10.sp)),
                                                      ),
                                                    )
                                                  : null,
                                            ),
                                            SizedBox(
                                              height: chartH,
                                              child: Align(
                                                alignment: Alignment.bottomCenter,
                                                child: AnimatedContainer(
                                                  duration: const Duration(milliseconds: 300),
                                                  curve: Curves.easeOutCubic,
                                                  width: on ? barW - 8.w : barW - 12.w,
                                                  height: y(p.rate).clamp(4, chartH),
                                                  decoration: BoxDecoration(
                                                    borderRadius: BorderRadius.circular(R.pill),
                                                    gradient: LinearGradient(
                                                      begin: Alignment.topCenter,
                                                      end: Alignment.bottomCenter,
                                                      colors: on
                                                          ? [color, color.withValues(alpha: .75)]
                                                          : [color.withValues(alpha: .55), color.withValues(alpha: .18)],
                                                    ),
                                                    boxShadow: on ? [BoxShadow(color: color.withValues(alpha: .3), blurRadius: 8, offset: const Offset(0, 3))] : null,
                                                  ),
                                                ),
                                              ),
                                            ),
                                            SizedBox(
                                              height: labelH,
                                              child: Column(
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  Text(
                                                    newMonth ? fmtKey(p.date, 'MMM') : _wd[d.weekday - 1],
                                                    style: T.small.copyWith(
                                                      fontSize: 9.5.sp,
                                                      fontWeight: newMonth ? FontWeight.w800 : FontWeight.w500,
                                                      color: newMonth ? C.primary : C.muted,
                                                    ),
                                                  ),
                                                  Container(
                                                    width: 22.r,
                                                    height: 20.r,
                                                    alignment: Alignment.center,
                                                    decoration: BoxDecoration(color: on ? color : Colors.transparent, borderRadius: BorderRadius.circular(R.sm)),
                                                    child: Text(
                                                      '${d.day}',
                                                      style: T.smallStrong.copyWith(fontSize: 11.sp, color: on ? Colors.white : C.ink),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 6.h),
          Row(
            children: [
              _Key(C.primary, 'Present rate'),
              SizedBox(width: 14.w),
              _Key(C.danger, 'Below $attendanceThresholdLabel% minimum'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count(this.label, this.n, this.color);
  final String label;
  final int n;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: 14.w),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text('$n', style: T.bodyStrong.copyWith(color: color, fontSize: 15.sp)),
        Text(label, style: T.small.copyWith(fontSize: 10.sp)),
      ],
    ),
  );
}

class _Key extends StatelessWidget {
  const _Key(this.color, this.label);
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3.r))),
      SizedBox(width: 5.w),
      Text(label, style: T.small.copyWith(fontSize: 11.sp)),
    ],
  );
}

class _Dashed extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = C.danger.withValues(alpha: .7)
      ..strokeWidth = size.height;
    for (double x = 0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, 0), Offset((x + 4).clamp(0, size.width), 0), p);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Average per school weekday, with the weakest day called out.
class _WeekdayCard extends StatelessWidget {
  const _WeekdayCard(this.s);
  final TrendsState s;
  @override
  Widget build(BuildContext context) {
    final wk = s.weekdays;
    final ext = s.extremes;
    final days = [for (var i = 0; i < 7; i++) if (wk[i] != null) i];
    final avg = s.avg;
    final lo = ext.lo;
    final gap = lo == null ? 0.0 : avg - wk[lo]!;
    return AppCard(
      radius: R.xl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('By weekday', style: T.h3),
          SizedBox(height: 10.h),
          Row(
            children: [
              for (final i in days)
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 2.w),
                    child: _DayTile(day: _short[i], rate: wk[i]!, low: i == lo, high: i == ext.hi),
                  ),
                ),
            ],
          ),
          if (lo != null && gap >= 1) ...[
            SizedBox(height: 12.h),
            Container(
              padding: EdgeInsets.all(10.r),
              decoration: BoxDecoration(color: C.warningSoft, borderRadius: BorderRadius.circular(R.md)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.lightbulb_outline_rounded, size: 16.r, color: C.warningDark),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: Text(
                      'Attendance is lowest on ${_plural[lo]} (${wk[lo]!.toStringAsFixed(1)}%), ${gap.toStringAsFixed(1)} pts under the class average.',
                      style: T.small.copyWith(color: C.warningDark, fontSize: 12.sp),
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

class _DayTile extends StatelessWidget {
  const _DayTile({required this.day, required this.rate, required this.low, required this.high});
  final String day;
  final double rate;
  final bool low, high;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = low ? (C.dangerSoft, C.danger) : (high ? (C.successSoft, C.successDark) : (C.surface, C.ink));
    return Container(
      padding: EdgeInsets.symmetric(vertical: 8.h),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.md)),
      child: Column(
        children: [
          Text(day.toUpperCase(), style: T.small.copyWith(fontSize: 10.sp, fontWeight: FontWeight.w700, color: low || high ? fg : C.slate)),
          SizedBox(height: 2.h),
          FittedBox(child: Text('${rate.round()}%', style: T.bodyStrong.copyWith(fontSize: 14.sp, color: fg))),
        ],
      ),
    );
  }
}

/// Students to follow up: below the minimum, close to it, or everyone; tap one for actions.
class _Students extends StatefulWidget {
  const _Students(this.s);
  final TrendsState s;
  @override
  State<_Students> createState() => _StudentsState();
}

class _StudentsState extends State<_Students> {
  String? _filter;
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final risk = s.atRisk.map((x) => x.id).toSet();
    final near = s.nearLimit.map((x) => x.id).toSet();
    final below = 'Below $attendanceThresholdLabel% (${risk.length})';
    final close = 'Near limit (${near.length})';
    final every = 'All (${s.roster.length})';
    final items = [below, close, every];
    final filter = items.contains(_filter) ? _filter! : (risk.isNotEmpty ? below : (near.isNotEmpty ? close : every));
    final list = [
      for (final t in s.students)
        if (filter == every || (filter == below ? risk.contains(t.student.id) : near.contains(t.student.id))) t,
    ];
    final shown = _all ? list : list.take(8).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('Students', style: T.h2)),
            if (s.perfect > 0) Pill('${s.perfect} with 100%', tone: Tone.success, icon: Icons.verified_outlined),
          ],
        ),
        SizedBox(height: 10.h),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: AppChoiceChips(
            items: items,
            value: filter,
            dense: true,
            onChanged: (v) => setState(() {
              _filter = v;
              _all = false;
            }),
          ),
        ),
        SizedBox(height: 10.h),
        if (list.isEmpty)
          AppCard(
            child: AppEmptyState(
              filter == below ? 'Everyone is above $attendanceThresholdLabel%' : 'No one close to the limit',
              hint: 'Nobody needs a follow-up for ${s.range.toLowerCase()}.',
              icon: Icons.verified_outlined,
            ),
          )
        else
          AppCard(
            radius: R.xl,
            padding: EdgeInsets.symmetric(vertical: 4.h),
            child: Column(
              children: [
                for (var i = 0; i < shown.length; i++) ...[
                  if (i > 0) Divider(height: 1, indent: 64.w, color: C.border),
                  _StudentRow(t: shown[i], s: s, risk: risk.contains(shown[i].student.id), near: near.contains(shown[i].student.id)),
                ],
              ],
            ),
          ),
        if (list.length > shown.length)
          Center(
            child: TextButton(
              onPressed: () => setState(() => _all = true),
              child: Text('Show all ${list.length}', style: T.smallStrong.copyWith(color: C.primary)),
            ),
          ),
      ],
    );
  }
}

class _StudentRow extends StatelessWidget {
  const _StudentRow({required this.t, required this.s, required this.risk, required this.near});
  final StudentTrend t;
  final TrendsState s;
  final bool risk, near;
  @override
  Widget build(BuildContext context) {
    final tone = risk ? Tone.danger : (near ? Tone.warning : Tone.success);
    final c = toneColors(tone);
    final medical = s.pendingMedical.contains(t.student.id);
    return InkWell(
      key: ValueKey('trend-student-${t.student.id}'),
      onTap: () => _studentActions(context, t, s),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
        child: Row(
          children: [
            Avatar(t.student.name, size: 40, tone: tone, image: t.student.photo.isEmpty ? null : t.student.photo),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.student.name, style: T.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: 2.h),
                  Text(
                    [
                      'Roll ${two(t.student.roll)}',
                      '${t.absent} absent',
                      if (t.late > 0) '${t.late} late',
                      if (medical) 'medical slip pending',
                    ].join(' • '),
                    style: T.small.copyWith(fontSize: 11.5.sp, color: medical ? C.primary : C.slate),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            SizedBox(width: 8.w),
            SizedBox(
              width: 54.w,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${t.rate.round()}%', style: T.bodyStrong.copyWith(color: c.fg)),
                  SizedBox(height: 4.h),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(R.pill),
                    child: LinearProgressIndicator(value: t.rate / 100, minHeight: 4.h, backgroundColor: C.border, color: c.fg),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: C.muted, size: 20.r),
          ],
        ),
      ),
    );
  }
}

/// Actions for one student: log, parent message, call, medical slips.
Future<void> _studentActions(BuildContext context, StudentTrend t, TrendsState s) async {
  final bloc = context.read<TrendsBloc>();
  final st = t.student;
  final recs = s.records;
  final absents = [for (final r in recs) if (r.codeOf(st.id) == AttCode.absent) r];
  final mondays = absents.where((r) => DateTime.parse(r.date).weekday == DateTime.monday).length;

  Future<void> notify() async {
    final n = await showNotifySheet(context, st, cls: s.cls, absentCount: absents.length, mondays: mondays);
    if (n != null) bloc.add(TrendsNoticeSent(n.notice, chat: n.chat));
  }

  Future<void> call() async {
    final digits = st.phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) {
      toast(context, 'No phone number on file for ${st.guardian.isEmpty ? st.name : st.guardian}.');
      return;
    }
    bloc.add(TrendsNoticeSent(ParentNotice(
      studentId: st.id,
      classId: st.classId,
      channels: const ['Call'],
      message: 'Phone call placed to ${st.guardian} ($digits)',
      at: DateTime.now().toIso8601String(),
    )));
    if (!await launchUrl(Uri(scheme: 'tel', path: digits)) && context.mounted) toast(context, 'Could not open the dialer.');
  }

  final pick = await showAppSheet<String>(
    context,
    title: st.name,
    subtitle: 'Roll ${two(st.roll)} • ${t.rate.toStringAsFixed(1)}% present • ${t.absent} absent of ${t.days} days',
    builder: (ctx) => Column(
      children: [
        _Action(Icons.history_rounded, 'View Log', 'Every day in ${s.range.toLowerCase()}, absences highlighted', () => Navigator.pop(ctx, 'log')),
        _Action(Icons.notifications_active_outlined, 'Notify Parent', 'Message ${st.guardian.isEmpty ? 'the guardian' : st.guardian} in the parent app', () => Navigator.pop(ctx, 'notify')),
        _Action(Icons.call_outlined, 'Call Parent', st.phone.isEmpty ? 'No number on file' : st.phone, () => Navigator.pop(ctx, 'call')),
        if (s.pendingMedical.contains(st.id))
          _Action(Icons.medical_services_outlined, 'Medical Slips', 'A slip is waiting for review', () => Navigator.pop(ctx, 'medical')),
      ],
    ),
  );
  if (!context.mounted) return;
  switch (pick) {
    case 'log':
      await showStudentLog(context, st: st, cls: s.cls, records: recs, onMessage: notify);
    case 'notify':
      await notify();
    case 'call':
      await call();
    case 'medical':
      context.push(Uri(path: RoutePaths.medicalSlips, queryParameters: {'student': st.id}).toString());
  }
}

class _Action extends StatelessWidget {
  const _Action(this.icon, this.title, this.sub, this.onTap);
  final IconData icon;
  final String title, sub;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(R.md),
    onTap: onTap,
    child: Padding(
      padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 4.w),
      child: Row(
        children: [
          IconTile(icon, size: 38),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.bodyStrong),
                Text(sub, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: C.muted, size: 20.r),
        ],
      ),
    ),
  );
}
