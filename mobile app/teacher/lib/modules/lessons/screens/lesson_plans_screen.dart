import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../bloc/lesson_plans_bloc.dart';
import '../bloc/lesson_plans_events.dart';
import '../bloc/lesson_plans_states.dart';
import '../models/lesson_plan_models.dart';
import 'widgets/lessons_common.dart';

/// Figma 1153:2895 "5.1 Lesson plans": syllabus progress, filters, the plans in progress with their
/// milestone checklist, then upcoming, draft and completed plans as compact rows.
class LessonPlansScreen extends StatelessWidget {
  const LessonPlansScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<LessonPlansBloc>()..add(const LessonPlansLoadRequested()),
        child: const _LessonPlansView(),
      );
}

class _LessonPlansView extends StatefulWidget {
  const _LessonPlansView();
  @override
  State<_LessonPlansView> createState() => _LessonPlansViewState();
}

class _LessonPlansViewState extends State<_LessonPlansView> {
  String _q = '', _cls = 'All', _stage = 'All';
  static const _stages = ['All', 'Ongoing', 'Upcoming', 'Drafts', 'Completed'];

  static String _group(LessonPlan p) => p.draft ? 'Drafts' : switch (p.stage) { 'ongoing' => 'Ongoing', 'completed' => 'Completed', _ => 'Upcoming' };

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    final all = st.plans;
    final classes = ['All', ...{for (final p in all) p.cls}];
    final q = _q.toLowerCase();
    final scoped = all.where((p) => (_cls == 'All' || p.cls == _cls) && '${p.title} ${p.summary} ${p.code} ${p.subject}'.toLowerCase().contains(q)).toList();
    int cnt(String s) => s == 'All' ? scoped.length : scoped.where((p) => _group(p) == s).length;
    final shown = scoped.where((p) => _stage == 'All' || _group(p) == _stage).toList();
    List<LessonPlan> of(String g) => shown.where((p) => _group(p) == g).toList();
    final ongoing = of('Ongoing'), upcoming = of('Upcoming'), drafts = of('Drafts'), done = of('Completed');
    final completedAll = all.where((p) => p.stage == 'completed').length;

    return BlocListener<LessonPlansBloc, LessonPlansState>(
      listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
      listener: (context, s) => handleNotice(context, s.notice!),
      child: DetailScaffold(
        title: 'Lesson Plans',
        subtitle: '${st.activeCount} active • ${st.draftCount} draft',
        fallbackRoute: RoutePaths.more,
        fab: FloatingActionButton.extended(
          heroTag: 'lesson-plan-new',
          tooltip: 'New lesson plan',
          backgroundColor: C.primary,
          foregroundColor: Colors.white,
          onPressed: () => context.push(RoutePaths.lessonPlanEdit('new')),
          icon: Icon(Icons.add_rounded, size: 22.r),
          label: Text('New plan', style: T.button),
        ),
        body: st.status != LessonPlansStatus.loaded
            ? const LessonsLoading()
            : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 100.h), children: [
                _ProgressCard(total: all.length, completed: completedAll, ongoing: all.where((p) => p.stage == 'ongoing' && !p.draft).length, drafts: st.draftCount),
                SizedBox(height: 14.h),
                AppSearchField(hint: 'Search chapters, topics or codes…', onChanged: (v) => setState(() => _q = v)),
                SizedBox(height: 10.h),
                _StageChips(stages: _stages, value: _stage, count: cnt, onChanged: (v) => setState(() => _stage = v)),
                if (classes.length > 2) ...[
                  SizedBox(height: 10.h),
                  FilterChips(items: [for (final c in classes) c == 'All' ? 'All classes' : 'Class $c'], value: _cls == 'All' ? 'All classes' : 'Class $_cls', onChanged: (v) => setState(() => _cls = v == 'All classes' ? 'All' : v.replaceFirst('Class ', ''))),
                ],
                SizedBox(height: 6.h),
                if (shown.isEmpty)
                  AppCard(child: AppEmptyState('No lesson plans found', hint: 'Try another filter or create a new plan.', icon: Icons.menu_book_outlined)),
                if (ongoing.isNotEmpty) ...[
                  const _Heading('In progress'),
                  for (final p in ongoing) _ActiveCard(p),
                ],
                if (upcoming.isNotEmpty) ...[
                  _Heading('Upcoming', count: upcoming.length),
                  _PlanList(upcoming),
                ],
                if (drafts.isNotEmpty) ...[
                  _Heading('Drafts', count: drafts.length),
                  _PlanList(drafts),
                ],
                if (done.isNotEmpty) ...[
                  _Heading('Completed', count: done.length),
                  _PlanList(done),
                ],
              ]),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.count});
  final String title;
  final int? count;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(2.w, 16.h, 2.w, 10.h),
        child: Row(children: [
          Expanded(child: Text(title, style: T.h3)),
          if (count != null) Pill('$count', tone: Tone.neutral),
        ]),
      );
}

class _StageChips extends StatelessWidget {
  const _StageChips({required this.stages, required this.value, required this.count, required this.onChanged});
  final List<String> stages;
  final String value;
  final int Function(String) count;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          clipBehavior: Clip.none,
          itemCount: stages.length,
          separatorBuilder: (_, _) => SizedBox(width: 8.w),
          itemBuilder: (_, i) {
            final s = stages[i], on = s == value, n = count(s);
            return Semantics(
              button: true,
              selected: on,
              label: '$s, $n',
              child: InkWell(
                borderRadius: BorderRadius.circular(R.pill),
                onTap: () => onChanged(s),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: on ? C.primary : C.bg, borderRadius: BorderRadius.circular(R.pill), border: Border.all(color: on ? C.primary : C.border)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(s, style: T.smallStrong.copyWith(color: on ? Colors.white : C.ink, fontSize: 12.5.sp)),
                    SizedBox(width: 6.w),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                      decoration: BoxDecoration(color: on ? Colors.white.withValues(alpha: .22) : C.surface, borderRadius: BorderRadius.circular(R.pill)),
                      child: Text('$n', style: T.small.copyWith(color: on ? Colors.white : C.slate, fontWeight: FontWeight.w800, fontSize: 10.5.sp)),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.total, required this.completed, required this.ongoing, required this.drafts});
  final int total, completed, ongoing, drafts;
  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0.0 : completed / total;
    return PanelCard(
      padding: EdgeInsets.all(16.r),
      child: Row(children: [
        SizedBox(
          width: 64.r,
          height: 64.r,
          child: Stack(alignment: Alignment.center, children: [
            CircularProgressIndicator(value: pct, strokeWidth: 6, backgroundColor: C.panelBorder, color: C.primary, strokeCap: StrokeCap.round),
            Text('${(pct * 100).round()}%', style: T.smallStrong.copyWith(color: C.primary, fontSize: 13.sp)),
          ]),
        ),
        SizedBox(width: 14.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('SYLLABUS PROGRESS', style: T.caps),
            SizedBox(height: 2.h),
            Text(total == 0 ? 'No lesson plans yet' : '$completed of $total plans completed', style: T.h3),
            SizedBox(height: 6.h),
            Wrap(spacing: 6.w, runSpacing: 6.h, children: [
              Pill('$ongoing in progress', tone: Tone.brand),
              if (drafts > 0) Pill('$drafts draft${drafts == 1 ? '' : 's'}', tone: Tone.warning),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// In progress
// ---------------------------------------------------------------------------

class _ActiveCard extends StatelessWidget {
  const _ActiveCard(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final ms = p.milestones;
    final done = p.doneMilestones;
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        radius: R.xl,
        padding: EdgeInsets.all(14.r),
        onTap: () => context.push(RoutePaths.lessonPlan(p.id)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Pill('Class ${p.cls}', tone: Tone.brand),
            SizedBox(width: 6.w),
            Expanded(child: Text('${p.subject} • ${p.code}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis)),
            Pill('Day ${p.day} of ${p.days}', tone: Tone.neutral, icon: Icons.calendar_today_outlined),
          ]),
          SizedBox(height: 10.h),
          Text(p.title, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
          if (p.summary.isNotEmpty) ...[SizedBox(height: 4.h), Text(p.summary, style: T.body, maxLines: 2, overflow: TextOverflow.ellipsis)],
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(child: Text('$done of ${ms.length} milestones done', style: T.smallStrong)),
            Text('${(p.progress * 100).round()}%', style: T.smallStrong.copyWith(color: C.primary)),
          ]),
          SizedBox(height: 6.h),
          AppProgress(p.progress, height: 6),
          if (p.sched.isNotEmpty || p.ncert.isNotEmpty) ...[
            SizedBox(height: 10.h),
            Wrap(spacing: 6.w, runSpacing: 6.h, children: [
              if (p.sched.isNotEmpty) AppTagChip(p.sched, icon: Icons.schedule_rounded),
              if (p.ncert.isNotEmpty) AppTagChip(p.ncert, icon: Icons.menu_book_outlined, neutral: true),
            ]),
          ],
          if (ms.isNotEmpty) ...[
            SizedBox(height: 14.h),
            Text('MILESTONES', style: T.capsMuted),
            SizedBox(height: 6.h),
            for (var i = 0; i < ms.length; i++)
              _MilestoneRow(ms[i], index: i + 1, onTap: () => context.read<LessonPlansBloc>().add(LessonMilestoneToggled(p.id, i))),
          ],
          SizedBox(height: 12.h),
          Row(children: [
            Expanded(flex: 3, child: AppButton('Open plan', icon: Icons.visibility_outlined, small: true, onPressed: () => context.push(RoutePaths.lessonPlan(p.id)))),
            SizedBox(width: 10.w),
            Expanded(flex: 2, child: AppButton('Edit Plan', icon: Icons.edit_outlined, kind: BtnKind.outline, small: true, onPressed: () => context.push(RoutePaths.lessonPlanEdit(p.id)))),
          ]),
        ]),
      ),
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow(this.m, {required this.index, required this.onTap});
  final Milestone m;
  final int index;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final done = m.done, today = m.today && !done;
    return Semantics(
      button: true,
      checked: done,
      label: m.title,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.md),
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: 42.h),
          margin: EdgeInsets.only(bottom: 4.h),
          padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 6.h),
          decoration: BoxDecoration(color: today ? C.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(R.md)),
          child: Row(children: [
            Container(
              width: 24.r,
              height: 24.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? C.success : Colors.transparent,
                border: Border.all(color: done ? C.success : (today ? C.primary : C.border), width: 1.5),
              ),
              child: done
                  ? Icon(Icons.check_rounded, size: 15.r, color: Colors.white)
                  : Center(child: Text('$index', style: T.small.copyWith(fontSize: 10.5.sp, fontWeight: FontWeight.w800, color: today ? C.primary : C.slate))),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Text(m.title,
                  maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: T.body.copyWith(fontSize: 13.5.sp, color: done ? C.slate : C.ink, fontWeight: today ? FontWeight.w700 : FontWeight.w500, decoration: done ? TextDecoration.lineThrough : null)),
            ),
            if (today) Pill('Today', tone: Tone.brand),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Upcoming / drafts / completed
// ---------------------------------------------------------------------------

class _PlanList extends StatelessWidget {
  const _PlanList(this.plans);
  final List<LessonPlan> plans;
  @override
  Widget build(BuildContext context) => AppCard(
        radius: R.xl,
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < plans.length; i++) ...[
            if (i > 0) Divider(height: 1, color: C.border, indent: 70.w),
            _PlanRow(plans[i]),
          ],
        ]),
      );
}

class _PlanRow extends StatelessWidget {
  const _PlanRow(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final draft = p.draft, completed = p.stage == 'completed';
    final (status, tone) = draft
        ? (p.approval.isEmpty ? 'Draft' : p.approval, Tone.warning)
        : completed
            ? ('Completed', Tone.success)
            : (p.approval.isEmpty ? 'Scheduled' : p.approval, Tone.brand);
    final meta = [
      'Class ${p.cls}',
      if (p.subject.isNotEmpty) p.subject,
      if (!draft && !completed && p.periods > 0) '${p.periods} period${p.periods == 1 ? '' : 's'}',
      if (draft && p.saved.isNotEmpty) p.saved,
    ].join(' • ');
    final d = DateTime.tryParse(p.date);
    return InkWell(
      onTap: () => context.push(draft ? RoutePaths.lessonPlanEdit(p.id) : RoutePaths.lessonPlan(p.id)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(14.w, 12.h, 12.w, 12.h),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          // Start date for scheduled plans; an icon for drafts and completed ones.
          Container(
            width: 44.r,
            height: 44.r,
            decoration: BoxDecoration(color: toneColors(tone).bg, borderRadius: BorderRadius.circular(R.md)),
            child: draft || completed || d == null
                ? Icon(draft ? Icons.edit_note_rounded : Icons.check_rounded, color: toneColors(tone).fg, size: 22.r)
                : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(fmtIso(p.date, 'MMM').toUpperCase(), style: T.capsMuted.copyWith(fontSize: 9.sp, color: toneColors(tone).fg)),
                    Text('${d.day}', style: T.h3.copyWith(color: toneColors(tone).fg)),
                  ]),
          ),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.title, style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
              SizedBox(height: 2.h),
              Text(meta, style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
              if (p.resources.isNotEmpty) ...[
                SizedBox(height: 2.h),
                Row(children: [
                  Icon(Icons.attach_file_rounded, size: 13.r, color: C.muted),
                  SizedBox(width: 4.w),
                  Expanded(child: Text(p.resources.map((r) => r.name).join(', '), style: T.small.copyWith(fontSize: 11.sp, color: C.muted), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ]),
              ],
            ]),
          ),
          SizedBox(width: 8.w),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Pill(status, tone: tone),
            SizedBox(height: 6.h),
            Icon(draft ? Icons.edit_outlined : Icons.chevron_right_rounded, size: 18.r, color: C.muted),
          ]),
        ]),
      ),
    );
  }
}
