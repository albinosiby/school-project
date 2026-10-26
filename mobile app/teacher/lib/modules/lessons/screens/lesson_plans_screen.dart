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

/// Figma 1153:2895 "5.1 Lesson plans".
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

  @override
  Widget build(BuildContext context) {
    final st = context.watch<LessonPlansBloc>().state;
    final all = st.plans;
    final classes = ['All', ...{for (final p in all) 'Class ${p.cls}'}];
    bool inStage(LessonPlan p, String s) => s == 'All' || p.stage == s.toLowerCase();
    final q = _q.toLowerCase();
    final scoped = all.where((p) => (_cls == 'All' || 'Class ${p.cls}' == _cls) && '${p.title} ${p.summary} ${p.code} ${p.subject}'.toLowerCase().contains(q)).toList();
    final shown = scoped.where((p) => inStage(p, _stage)).toList();
    int cnt(String s) => scoped.where((p) => inStage(p, s)).length;
    final ongoing = shown.where((p) => p.stage == 'ongoing').toList();
    final pipeline = shown.where((p) => p.stage == 'upcoming').toList();
    final done = shown.where((p) => p.stage == 'completed').toList();
    final pct = all.isEmpty ? 0 : (all.where((p) => p.stage == 'completed').length * 100 / all.length).round();
    final stages = const ['All', 'Ongoing', 'Upcoming', 'Completed'];

    return BlocListener<LessonPlansBloc, LessonPlansState>(
      listenWhen: (a, b) => a.notice != b.notice && b.notice != null,
      listener: (context, s) => handleNotice(context, s.notice!),
      child: DetailScaffold(
        title: 'Lesson Plans',
        subtitle: '${st.activeCount} active • ${st.draftCount} draft',
        fallbackRoute: RoutePaths.more,
        actions: [
          IconButton(
            tooltip: 'New lesson plan',
            onPressed: () => context.push(RoutePaths.lessonPlanEdit('new')),
            icon: Icon(Icons.add_circle_outline_rounded, color: C.primary, size: 26.r),
          ),
        ],
        body: st.status != LessonPlansStatus.loaded
            ? const LessonsLoading()
            : ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 100.h), children: [
                AppSearchField(hint: 'Search chapters, topics, or standards...', onChanged: (v) => setState(() => _q = v)),
                SizedBox(height: 12.h),
                FilterChips(items: classes, value: classes.contains(_cls) ? _cls : 'All', onChanged: (v) => setState(() => _cls = v)),
                SizedBox(height: 12.h),
                AppSegmented(
                  track: true,
                  items: [for (final s in stages) '$s (${cnt(s)})'],
                  value: '$_stage (${cnt(_stage)})',
                  onChanged: (v) => setState(() => _stage = v.split(' (').first),
                ),
                SizedBox(height: 16.h),
                if (shown.isEmpty) AppEmptyState('No lesson plans found', hint: 'Try another filter or create a new plan.', icon: Icons.menu_book_outlined),
                for (final p in ongoing) _ActiveCard(p),
                if (pipeline.isNotEmpty) ...[
                  Row(children: [
                    Flexible(child: Text('Upcoming Pipeline', style: T.h2, maxLines: 1, overflow: TextOverflow.ellipsis)),
                    SizedBox(width: 8.w),
                    const Pill('Term 2', tone: Tone.neutral),
                    const Spacer(),
                    Text('${pipeline.length} Scheduled', style: T.small),
                  ]),
                  SizedBox(height: 12.h),
                  for (final p in pipeline) _PipelineCard(p),
                ],
                if (done.isNotEmpty) ...[
                  const SectionHeader('Completed', caps: true),
                  for (final p in done) _PipelineCard(p),
                ],
                SizedBox(height: 4.h),
                PanelCard(
                  child: Row(children: [
                    IconTile(Icons.speed_rounded, size: 40),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('CURRICULUM PACING', style: T.caps),
                        Text('You are 2 days ahead of schedule for Term 2.', style: T.bodyStrong),
                        Text('Syllabus is $pct% completed.', style: T.small),
                      ]),
                    ),
                  ]),
                ),
              ]),
      ),
    );
  }
}

class _ActiveCard extends StatelessWidget {
  const _ActiveCard(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final ms = p.milestones;
    final done = p.doneMilestones;
    return Padding(
      padding: EdgeInsets.only(bottom: 16.h),
      child: AppCard(
        onTap: () => context.push(RoutePaths.lessonPlan(p.id)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Align(alignment: Alignment.centerLeft, child: Pill('ACTIVE PERIOD • CLASS ${p.cls}', dot: true))),
            SizedBox(width: 8.w),
            Text(p.code, style: T.small),
          ]),
          SizedBox(height: 14.h),
          Text(p.title, style: T.h1, maxLines: 3, overflow: TextOverflow.ellipsis),
          SizedBox(height: 6.h),
          Text(p.summary, style: T.body, maxLines: 3, overflow: TextOverflow.ellipsis),
          SizedBox(height: 14.h),
          Container(
            padding: EdgeInsets.all(12.r),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
            child: Column(children: [
              Row(children: [
                Text('Step ${(done + 1).clamp(1, ms.isEmpty ? 1 : ms.length)} of ${ms.length}', style: T.smallStrong),
                const Spacer(),
                Text('${(p.progress * 100).round()}% Completed', style: T.smallStrong.copyWith(color: C.primary)),
              ]),
              SizedBox(height: 8.h),
              AppProgress(p.progress),
              SizedBox(height: 8.h),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('Day 1: Intro', style: T.small), Text('Day ${p.days}: Drill', style: T.small)]),
            ]),
          ),
          SizedBox(height: 12.h),
          Wrap(spacing: 8.w, runSpacing: 8.h, children: [
            if (p.sched.isNotEmpty) AppTagChip(p.sched, icon: Icons.schedule_rounded),
            AppTagChip('Day ${p.day} of ${p.days}', icon: Icons.calendar_today_outlined),
            if (p.ncert.isNotEmpty) AppTagChip(p.ncert, icon: Icons.menu_book_outlined, neutral: true),
          ]),
          SizedBox(height: 16.h),
          Text('TEACHING MILESTONES', style: T.capsMuted),
          SizedBox(height: 8.h),
          for (var i = 0; i < ms.length; i++)
            _MilestoneRow(ms[i], onTap: () => context.read<LessonPlansBloc>().add(LessonMilestoneToggled(p.id, i))),
          SizedBox(height: 8.h),
          Row(children: [
            Expanded(flex: 3, child: AppButton('View Lesson Plan', icon: Icons.visibility_outlined, onPressed: () => context.push(RoutePaths.lessonPlan(p.id)))),
            SizedBox(width: 10.w),
            Expanded(flex: 2, child: AppButton('Edit Plan', icon: Icons.edit_outlined, kind: BtnKind.outline, onPressed: () => context.push(RoutePaths.lessonPlanEdit(p.id)))),
          ]),
        ]),
      ),
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow(this.m, {required this.onTap});
  final Milestone m;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final done = m.done, today = m.today && !done;
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h),
      child: Semantics(
        button: true, checked: done, label: m.title,
        child: InkWell(
          borderRadius: BorderRadius.circular(R.md),
          onTap: onTap,
          child: Container(
            constraints: BoxConstraints(minHeight: 44.h),
            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
            decoration: BoxDecoration(
              color: today ? C.primarySoft : C.surface,
              borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: today ? C.primary.withValues(alpha: .4) : Colors.transparent),
            ),
            child: Row(children: [
              Icon(done ? Icons.check_circle_outline_rounded : Icons.radio_button_unchecked, size: 20.r, color: done || today ? C.primary : C.muted),
              SizedBox(width: 10.w),
              Expanded(
                child: Text(m.title,
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: T.bodyStrong.copyWith(fontSize: 13.5.sp, color: done ? C.slate : (today ? C.primary : C.ink), decoration: done ? TextDecoration.lineThrough : null)),
              ),
              if (today)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(R.sm)),
                  child: Text('Today', style: T.smallStrong.copyWith(color: Colors.white)),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _PipelineCard extends StatelessWidget {
  const _PipelineCard(this.p);
  final LessonPlan p;
  @override
  Widget build(BuildContext context) {
    final draft = p.draft, completed = p.stage == 'completed';
    final eyebrow = draft ? 'CLASS ${p.cls} • ${p.subject.toUpperCase()}' : (completed ? 'COMPLETED' : 'NEXT WEEK • CLASS ${p.cls}');
    final pill = draft ? (p.approval.isEmpty ? 'Draft' : p.approval) : (completed ? 'Completed' : (p.approval.isEmpty ? 'Scheduled' : p.approval));
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: AppCard(
        onTap: () => context.push(RoutePaths.lessonPlan(p.id)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(eyebrow, style: T.caps, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 8.w),
            Flexible(child: Pill(pill, tone: draft ? Tone.warning : Tone.success)),
          ]),
          SizedBox(height: 10.h),
          Text(p.title, style: T.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 4.h),
          Text(p.summary, style: T.body, maxLines: 2, overflow: TextOverflow.ellipsis),
          SizedBox(height: 10.h),
          if (p.resources.isNotEmpty)
            Row(children: [
              Icon(Icons.attach_file_rounded, size: 16.r, color: C.primary),
              SizedBox(width: 6.w),
              Expanded(child: Text(p.resources.map((r) => r.name).join(' & '), style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          SizedBox(height: 6.h),
          Text(draft ? (p.saved.isEmpty ? 'Draft' : p.saved) : 'Starts ${fmtIso(p.date)} • ${p.periods} Periods allocated', style: T.small),
          SizedBox(height: 12.h),
          AppButton(
            draft ? 'Continue Editing' : 'View Lesson Plan',
            kind: draft ? BtnKind.soft : BtnKind.outline, small: true,
            onPressed: () => context.push(draft ? RoutePaths.lessonPlanEdit(p.id) : RoutePaths.lessonPlan(p.id)),
          ),
        ]),
      ),
    );
  }
}
