import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/assignments_bloc.dart';
import '../bloc/assignments_events.dart';
import '../bloc/assignments_states.dart';
import '../models/homework_grading.dart';
import 'homework_screen.dart' show dueLabel;

const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

enum _Tab { active, review, upcoming, closed }

const _tabNames = {_Tab.active: 'Active', _Tab.review: 'To review', _Tab.upcoming: 'Upcoming', _Tab.closed: 'Closed'};

/// Assignments across all the teacher's classes: what needs reviewing, what is due, what is scheduled and
/// what is closed. Each card opens the assignment (hand-ins and grading); "New assignment" opens the form.
class AssignmentsScreen extends StatelessWidget {
  const AssignmentsScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      BlocProvider(create: (_) => getIt<AssignmentsBloc>()..add(const AssignmentsLoadRequested()), child: const _View());
}

class _View extends StatefulWidget {
  const _View();
  @override
  State<_View> createState() => _ViewState();
}

class _ViewState extends State<_View> {
  _Tab _tab = _Tab.active;
  String _classId = '';

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AssignmentsBloc>().state;
    final today = DateTime.now();
    final all = s.items;
    final mine = [for (final a in all) if (_classId.isEmpty || a.hw.classId == _classId) a];
    final active = [for (final a in mine) if (a.active) a];
    final review = [for (final a in mine) if (!a.upcoming && a.stats.toGrade > 0) a]..sort((a, b) => b.stats.toGrade.compareTo(a.stats.toGrade));
    final upcoming = [for (final a in mine) if (a.upcoming) a]
      ..sort((a, b) => (a.hw.publishAt ?? DateTime(2100)).compareTo(b.hw.publishAt ?? DateTime(2100)));
    final closed = [for (final a in mine) if (a.closed) a]..sort((a, b) => b.hw.due.compareTo(a.hw.due));
    final counts = {_Tab.active: active.length, _Tab.review: review.length, _Tab.upcoming: upcoming.length, _Tab.closed: closed.length};

    final toReview = review.fold<int>(0, (n, a) => n + a.stats.toGrade);
    final dueWeek = active.where((a) {
      final d = a.daysLeft(today);
      return d != null && d >= 0 && d < 7;
    }).length;
    final late = [for (final a in mine) if (!a.upcoming) a].fold<int>(0, (n, a) => n + a.stats.late);

    Widget body;
    if (s.status == AssignmentsStatus.failure) {
      body = AppErrorWidget(message: s.error ?? 'Could not load assignments', onRetry: () => context.read<AssignmentsBloc>().add(const AssignmentsLoadRequested()));
    } else if (s.status != AssignmentsStatus.loaded) {
      body = const SchoolSkeletonList();
    } else {
      final list = switch (_tab) {
        _Tab.active => active,
        _Tab.review => review,
        _Tab.upcoming => upcoming,
        _Tab.closed => closed,
      };
      body = RefreshIndicator(
        onRefresh: () async => context.read<AssignmentsBloc>().add(const AssignmentsLoadRequested()),
        child: ListView(
          padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 100.h),
          children: [
            _Hero(
              toReview: toReview,
              active: active.length,
              dueWeek: dueWeek,
              late: late,
              onReview: review.isEmpty ? null : () => context.push(RoutePaths.homework(review.first.hw.id)),
            ),
            if (s.usedClasses.length > 1) ...[
              SizedBox(height: 14.h),
              SizedBox(
                height: 36.h,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _ClassChip(key: const ValueKey('asg-class-all'), label: 'All classes', selected: _classId.isEmpty, onTap: () => setState(() => _classId = '')),
                    for (final c in s.usedClasses)
                      _ClassChip(key: ValueKey('asg-class-${c.id}'), label: 'Class ${c.label}', selected: _classId == c.id, onTap: () => setState(() => _classId = c.id)),
                  ],
                ),
              ),
            ],
            SizedBox(height: 14.h),
            _Tabs(value: _tab, counts: counts, onChanged: (t) => setState(() => _tab = t)),
            SizedBox(height: 12.h),
            if (list.isEmpty)
              Padding(
                padding: EdgeInsets.only(top: 24.h),
                child: AppEmptyState(
                  switch (_tab) {
                    _Tab.active => 'No active assignments',
                    _Tab.review => 'Nothing to review',
                    _Tab.upcoming => 'Nothing scheduled',
                    _Tab.closed => 'No closed assignments',
                  },
                  hint: switch (_tab) {
                    _Tab.review => 'Hand-ins waiting for marks show here.',
                    _Tab.upcoming => 'Assignments set to publish later show here.',
                    _ => 'Tap New assignment to set one for a class.',
                  },
                  icon: _tab == _Tab.review ? Icons.task_alt_rounded : Icons.assignment_outlined,
                ),
              )
            else if (_tab == _Tab.active)
              ..._grouped(active, today)
            else
              for (final a in list) _AssignmentCard(a, today: today, key: ValueKey('asg-${a.hw.id}')),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: DetailHeader(
        'Assignments',
        subtitle: s.status == AssignmentsStatus.loaded ? '${active.length} active • $toReview to review' : null,
        fallbackRoute: RoutePaths.home,
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const ValueKey('asg-new'),
        heroTag: 'asg-new',
        onPressed: () => context.push(_classId.isEmpty ? RoutePaths.homeworkNew : '${RoutePaths.homeworkNew}?classId=$_classId'),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New assignment'),
      ),
      body: AppNavScope(dock: false, child: body),
    );
  }

  /// Active assignments under Overdue / Due today / This week / Later.
  List<Widget> _grouped(List<AssignmentItem> items, DateTime today) {
    final groups = <String, List<AssignmentItem>>{'Overdue': [], 'Due today': [], 'This week': [], 'Later': []};
    for (final a in items) {
      final d = a.daysLeft(today) ?? 999;
      groups[d < 0 ? 'Overdue' : d == 0 ? 'Due today' : d < 7 ? 'This week' : 'Later']!.add(a);
    }
    return [
      for (final g in groups.entries)
        if (g.value.isNotEmpty) ...[
          Padding(
            padding: EdgeInsets.fromLTRB(2.w, 6.h, 2.w, 8.h),
            child: Row(
              children: [
                Text(g.key.toUpperCase(), style: T.capsMuted.copyWith(color: g.key == 'Overdue' ? C.danger : null)),
                SizedBox(width: 6.w),
                Text('${g.value.length}', style: T.capsMuted),
              ],
            ),
          ),
          for (final a in g.value) _AssignmentCard(a, today: today, key: ValueKey('asg-${a.hw.id}')),
        ],
    ];
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.toReview, required this.active, required this.dueWeek, required this.late, this.onReview});
  final int toReview, active, dueWeek, late;
  final VoidCallback? onReview;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(16.r),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(R.xl),
      gradient: const LinearGradient(colors: [C.primary, C.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('$toReview', style: T.stat.copyWith(color: Colors.white, fontSize: 34.sp, height: 1)),
            SizedBox(width: 8.w),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: 3.h),
                child: Text(toReview == 1 ? 'hand-in to review' : 'hand-ins to review', style: T.bodyStrong.copyWith(color: Colors.white)),
              ),
            ),
            if (onReview != null)
              Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(R.pill),
                child: InkWell(
                  key: const ValueKey('asg-review-next'),
                  borderRadius: BorderRadius.circular(R.pill),
                  onTap: onReview,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Review', style: T.smallStrong.copyWith(color: C.primary)),
                        Icon(Icons.chevron_right_rounded, size: 18.r, color: C.primary),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
        SizedBox(height: 14.h),
        Row(
          children: [
            _HeroStat('$active', 'Active'),
            _HeroStat('$dueWeek', 'Due this week'),
            _HeroStat('$late', 'Late hand-ins'),
          ],
        ),
      ],
    ),
  );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat(this.value, this.label);
  final String value, label;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      margin: EdgeInsets.only(right: 8.w),
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 8.h),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(R.md)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: T.h3.copyWith(color: Colors.white)),
          Text(label, style: T.small.copyWith(color: Colors.white70, fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    ),
  );
}

class _ClassChip extends StatelessWidget {
  const _ClassChip({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(right: 8.w),
    child: Material(
      color: selected ? C.ink : C.surface,
      borderRadius: BorderRadius.circular(R.pill),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.pill),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 14.w),
          alignment: Alignment.center,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: selected ? C.ink : C.border)),
          child: Text(label, style: T.smallStrong.copyWith(color: selected ? Colors.white : C.ink)),
        ),
      ),
    ),
  );
}

/// Underlined tabs with counts.
class _Tabs extends StatelessWidget {
  const _Tabs({required this.value, required this.counts, required this.onChanged});
  final _Tab value;
  final Map<_Tab, int> counts;
  final ValueChanged<_Tab> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(4.r),
    decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(R.lg)),
    child: Row(
      children: [
        for (final t in _Tab.values)
          Expanded(
            child: GestureDetector(
              key: ValueKey('asg-tab-${t.name}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => onChanged(t),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: EdgeInsets.symmetric(vertical: 8.h),
                decoration: BoxDecoration(
                  color: t == value ? C.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(R.md),
                  boxShadow: t == value ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))] : null,
                ),
                child: Column(
                  children: [
                    Text('${counts[t]}', style: T.bodyStrong.copyWith(color: t == value ? C.primary : C.ink)),
                    Text(_tabNames[t]!, style: T.small.copyWith(fontSize: 11.sp, color: t == value ? C.primary : C.slate), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard(this.a, {super.key, required this.today});
  final AssignmentItem a;
  final DateTime today;

  @override
  Widget build(BuildContext context) {
    final h = a.hw, st = a.stats;
    final left = a.daysLeft(today);
    final due = DateTime.tryParse(h.due.length >= 10 ? h.due.substring(0, 10) : h.due);
    final (Color fg, Color bg) = a.upcoming
        ? (C.purple, C.purpleSoft)
        : a.closed
        ? (C.slate, C.panel)
        : left == null
        ? (C.primary, C.primarySoft)
        : left < 0
        ? (C.danger, C.dangerSoft)
        : left <= 1
        ? (C.warningDark, C.warningSoft)
        : (C.primary, C.primarySoft);
    final pct = st.total == 0 ? 0.0 : st.turnedIn / st.total;
    final publish = h.publishAt;
    final files = h.attachments.length;

    return Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: AppCard(
        radius: R.xl,
        padding: EdgeInsets.all(14.r),
        onTap: () => context.push(RoutePaths.homework(h.id)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48.r,
                  padding: EdgeInsets.symmetric(vertical: 6.h),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.md)),
                  child: Column(
                    children: [
                      Text(due == null ? '—' : '${due.day}', style: T.h2.copyWith(color: fg, height: 1.1)),
                      Text(due == null ? '' : _mon[due.month - 1].toUpperCase(), style: T.caps.copyWith(color: fg, fontSize: 10.sp)),
                    ],
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        [a.classLabel, if (h.subject.isNotEmpty) h.subject].join(' • ').toUpperCase(),
                        style: T.capsMuted.copyWith(fontSize: 10.sp),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: 2.h),
                      Text(h.title, style: T.bodyStrong.copyWith(fontSize: 15.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 2.h),
                      Text(
                        a.upcoming
                            ? (publish == null ? 'Draft — not published' : 'Publishes ${publish.day} ${_mon[publish.month - 1]}, ${_t(publish)}')
                            : a.closed
                            ? 'Closed'
                            : dueLabel(h, today),
                        style: T.small.copyWith(color: a.upcoming ? C.purple : (left != null && left < 0 && a.active ? C.danger : C.slate), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: C.muted, size: 22.r),
              ],
            ),
            if (!a.upcoming) ...[
              SizedBox(height: 12.h),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(R.pill),
                      child: Stack(
                        children: [
                          Container(height: 6.h, color: C.panel),
                          FractionallySizedBox(
                            widthFactor: st.total == 0 ? 0 : st.graded / st.total,
                            child: Container(height: 6.h, color: C.success),
                          ),
                          FractionallySizedBox(
                            widthFactor: pct,
                            child: Container(height: 6.h, color: C.primary.withValues(alpha: 0.35)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Text('${st.turnedIn}/${st.total} handed in', style: T.small.copyWith(fontSize: 12.sp, color: C.ink)),
                ],
              ),
            ],
            SizedBox(height: 10.h),
            Wrap(
              spacing: 6.w,
              runSpacing: 6.h,
              children: [
                if (st.toGrade > 0) Pill('${st.toGrade} to review', tone: Tone.warning, icon: Icons.rate_review_outlined),
                if (st.late > 0) Pill('${st.late} late', tone: Tone.danger),
                if (!a.upcoming && st.graded > 0) Pill('${st.graded} graded', tone: Tone.success),
                Pill(h.graded ? 'Out of ${h.maxMarks}' : 'Not graded', tone: Tone.neutral),
                if (files > 0) Pill('$files ${files == 1 ? 'file' : 'files'}', tone: Tone.neutral, icon: Icons.attach_file_rounded),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _t(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
  }
}
